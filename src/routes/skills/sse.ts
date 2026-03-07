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

// ── Type guards for SDK message content blocks ──────────────

interface TextBlock { type: 'text'; text: string }
interface ToolUseBlock { type: 'tool_use'; name: string; input: unknown }
interface ToolResultBlock { type: 'tool_result'; tool_use_id?: string; content?: unknown }

function isTextBlock(b: unknown): b is TextBlock {
  return typeof b === 'object' && b !== null && 'type' in b && (b as TextBlock).type === 'text';
}
function isToolUseBlock(b: unknown): b is ToolUseBlock {
  return typeof b === 'object' && b !== null && 'type' in b && (b as ToolUseBlock).type === 'tool_use';
}
function isToolResultBlock(b: unknown): b is ToolResultBlock {
  return typeof b === 'object' && b !== null && 'type' in b && (b as ToolResultBlock).type === 'tool_result';
}

interface ContentBlockDelta {
  type: 'content_block_delta';
  delta: { type: string; text?: string; partial_json?: string };
}
function isContentBlockDelta(evt: unknown): evt is ContentBlockDelta {
  return typeof evt === 'object' && evt !== null && 'type' in evt
    && (evt as ContentBlockDelta).type === 'content_block_delta';
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
      const evt = ('event' in message) ? message.event : undefined;
      if (isContentBlockDelta(evt)) {
        if (evt.delta.type === 'text_delta') {
          return { event: 'text', data: { text: evt.delta.text } };
        }
        if (evt.delta.type === 'input_json_delta') {
          return { event: 'tool_input', data: { partial_json: evt.delta.partial_json } };
        }
      }
      return null;
    }

    case 'assistant': {
      const content = (message as { message?: { content?: unknown[] } }).message?.content;
      if (!Array.isArray(content)) return null;

      const toolUseBlocks = content.filter(isToolUseBlock);
      if (toolUseBlocks.length > 0) {
        return {
          event: 'tool_use',
          data: toolUseBlocks.map((b) => ({ tool: b.name, input: b.input })),
        };
      }

      const textBlocks = content.filter(isTextBlock);
      if (textBlocks.length > 0) {
        return {
          event: 'assistant',
          data: { text: textBlocks.map((b) => b.text).join('') },
        };
      }
      return null;
    }

    case 'user': {
      const content = (message as { message?: { content?: unknown[] } }).message?.content;
      if (!Array.isArray(content)) return null;
      const results = content.filter(isToolResultBlock);
      if (results.length === 0) return null;
      return {
        event: 'tool_result',
        data: results.map((b) => ({
          toolUseId: b.tool_use_id,
          output: truncate(String(JSON.stringify(b.content) ?? ''), 2000),
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
