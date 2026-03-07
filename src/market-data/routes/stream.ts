import type { FastifyPluginAsync } from 'fastify';
import { BoundedQueue } from '../../shared/lib/bounded-queue.js';

// ws readyState constants — avoids runtime dependency on @fastify/websocket's re-export
const WS_OPEN = 1;

const HEARTBEAT_INTERVAL_MS = 30_000;
const FLUSH_INTERVAL_MS = 50;
const QUEUE_MAX_SIZE = 100;
const REPLAY_BUFFER_SIZE = 50;
const PROTOCOL_VERSION = 2;

interface EventEnvelope {
  id: number;
  type: string;
  payload: unknown;
}

const streamRoute: FastifyPluginAsync = async (fastify) => {
  let eventCounter = 0;
  const replayBuffer: EventEnvelope[] = [];
  const clientQueues = new Set<BoundedQueue<string>>();

  const pushToReplayBuffer = (envelope: EventEnvelope) => {
    if (replayBuffer.length >= REPLAY_BUFFER_SIZE) {
      replayBuffer.shift();
    }
    replayBuffer.push(envelope);
  };

  // Route-level listeners: assign IDs and fan out to per-client queues once
  const broadcastEvent = (type: string, payload: unknown) => {
    const envelope: EventEnvelope = { id: ++eventCounter, type, payload };
    pushToReplayBuffer(envelope);
    const msg = JSON.stringify(envelope);
    for (const q of clientQueues) {
      q.push(msg);
    }
  };

  const { emitter } = fastify;
  emitter.on('bar',   (e: unknown) => broadcastEvent('bar', e));
  emitter.on('fill',  (e: unknown) => broadcastEvent('fill', e));
  emitter.on('close', (e: unknown) => broadcastEvent('close', e));

  // GET /stream — WebSocket real-time event stream
  // Protocol v2: { id, type, payload } envelopes with replay support
  // Clients can request v1 (raw payloads) via ?v=1 query param
  fastify.get('/stream', { websocket: true }, (socket, request) => {
    const query = request.query as Record<string, string>;
    const clientVersion = Number(query['v']) || PROTOCOL_VERSION;
    const useEnvelope = clientVersion >= 2;
    const queue = new BoundedQueue<string>(QUEUE_MAX_SIZE);
    let lastDroppedSnapshot = 0;

    clientQueues.add(queue);

    // Send protocol version on connect
    if (useEnvelope) {
      socket.send(JSON.stringify({ type: 'connected', protocol: PROTOCOL_VERSION }));
    }

    // ── Reconnection: replay missed events ──
    const lastEventId =
      (request.headers['last-event-id'] as string | undefined) ??
      query['lastEventId'];

    if (lastEventId != null) {
      const id = Number(lastEventId);
      if (!Number.isNaN(id)) {
        for (const envelope of replayBuffer) {
          if (envelope.id > id) {
            queue.push(JSON.stringify(envelope));
          }
        }
      }
    }

    // ── Flush queue to socket ──
    const flushInterval = setInterval(() => {
      if (socket.readyState !== WS_OPEN) return;

      if (useEnvelope) {
        const dropped = queue.droppedCount - lastDroppedSnapshot;
        if (dropped > 0) {
          lastDroppedSnapshot = queue.droppedCount;
          socket.send(JSON.stringify({ type: 'dropped', count: dropped }));
        }
      }

      const messages = queue.drain();
      for (const msg of messages) {
        if (socket.readyState !== WS_OPEN) break;
        if (useEnvelope) {
          socket.send(msg);
        } else {
          // v1 compat: strip envelope, send raw payload
          const parsed = JSON.parse(msg) as EventEnvelope;
          socket.send(JSON.stringify(parsed.payload));
        }
      }
    }, FLUSH_INTERVAL_MS);

    // ── Heartbeat / keepalive ──
    let isAlive = true;
    socket.on('pong', () => { isAlive = true; });

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();
    }, HEARTBEAT_INTERVAL_MS);

    // ── Cleanup ──
    const cleanup = () => {
      clearInterval(heartbeat);
      clearInterval(flushInterval);
      clientQueues.delete(queue);
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
};

export default streamRoute;
