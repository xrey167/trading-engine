import type { FastifyReply } from 'fastify';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * Streams an Agent SDK query as SSE events.
 * Owns the entire response lifecycle: hijack → writeHead → stream → end.
 */
export async function streamAgentQuery(
  reply: FastifyReply,
  controller: AbortController,
  queryOptions: Parameters<typeof query>[0],
): Promise<void> {
  // Take ownership of the response from Fastify
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Heartbeat keeps proxies/browsers from closing idle connections
  const heartbeat = setInterval(() => {
    if (!reply.raw.destroyed) reply.raw.write(':keepalive\n\n');
  }, 15_000);

  // 5-minute server-side timeout as safety net
  const timeout = setTimeout(() => controller.abort(), 5 * 60_000);

  try {
    const agentQuery = query(queryOptions);

    for await (const message of agentQuery) {
      if (controller.signal.aborted) break;
      const sse = mapToSSE(message);
      if (sse && !reply.raw.destroyed) {
        reply.raw.write(`event: ${sse.event}\ndata: ${JSON.stringify(sse.data)}\n\n`);
      }
    }

    if (!reply.raw.destroyed) {
      reply.raw.write('event: done\ndata: {}\n\n');
    }
  } catch (err) {
    if (!reply.raw.destroyed) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
    }
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timeout);
    if (!reply.raw.destroyed) reply.raw.end();
  }
}

// Helper: safely access properties on loosely-typed SDK message internals
function prop(obj: unknown, key: string): unknown {
  return (obj as Record<string, unknown>)?.[key];
}

function mapToSSE(message: SDKMessage): { event: string; data: unknown } | null {
  switch (message.type) {
    case 'system':
      return {
        event: 'init',
        data: {
          sessionId: ('session_id' in message) ? message.session_id : undefined,
          tools: ('tools' in message) ? message.tools : undefined,
        },
      };

    case 'stream_event': {
      // Raw Claude API streaming event — forward text deltas and tool input deltas
      const evt = prop(message, 'event') as Record<string, unknown> | undefined;
      if (evt?.type === 'content_block_delta') {
        const delta = evt.delta as Record<string, unknown> | undefined;
        if (delta?.type === 'text_delta') {
          return { event: 'text', data: { text: delta.text } };
        }
        if (delta?.type === 'input_json_delta') {
          return { event: 'tool_input', data: { partial_json: delta.partial_json } };
        }
      }
      return null;
    }

    case 'assistant': {
      const content = (message as { message?: { content?: unknown[] } }).message?.content;
      if (!Array.isArray(content)) return null;

      // Emit tool_use blocks
      const toolUseBlocks = content.filter((b) => prop(b, 'type') === 'tool_use');
      if (toolUseBlocks.length > 0) {
        return {
          event: 'tool_use',
          data: toolUseBlocks.map((b) => ({
            tool: prop(b, 'name'),
            input: prop(b, 'input'),
          })),
        };
      }

      // Emit text blocks
      const textBlocks = content.filter((b) => prop(b, 'type') === 'text');
      if (textBlocks.length > 0) {
        return {
          event: 'assistant',
          data: {
            text: textBlocks.map((b) => prop(b, 'text') ?? '').join(''),
          },
        };
      }
      return null;
    }

    case 'user': {
      // tool_result messages — truncate large outputs
      const content = (message as { message?: { content?: unknown[] } }).message?.content;
      if (!Array.isArray(content)) return null;
      const results = content.filter((b) => prop(b, 'type') === 'tool_result');
      if (results.length === 0) return null;
      return {
        event: 'tool_result',
        data: results.map((b) => ({
          toolUseId: prop(b, 'tool_use_id'),
          output: truncate(JSON.stringify(prop(b, 'content')), 2000),
        })),
      };
    }

    case 'result':
      if ('error' in message && message.error) {
        return { event: 'error', data: { error: message.error } };
      }
      return {
        event: 'result',
        data: {
          result: ('result' in message) ? message.result : undefined,
          cost: ('cost_usd' in message) ? message.cost_usd : undefined,
          turns: ('num_turns' in message) ? message.num_turns : undefined,
          sessionId: ('session_id' in message) ? message.session_id : undefined,
        },
      };

    default:
      return { event: 'unknown', data: { type: message.type } };
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…[truncated]` : str;
}
