import type { FastifyPluginAsync } from 'fastify';
import { WebSocket } from '@fastify/websocket';

const HEARTBEAT_INTERVAL_MS = 30_000;

const streamRoute: FastifyPluginAsync = async (fastify) => {
  // GET /stream — WebSocket real-time event stream
  fastify.get('/stream', { websocket: true }, (socket) => {
    const { emitter } = fastify;

    // ── Event type envelope ──
    const sendEvent = (type: string, payload: unknown) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, payload }));
      }
    };

    const onBar   = (event: unknown) => sendEvent('bar', event);
    const onFill  = (event: unknown) => sendEvent('fill', event);
    const onClose = (event: unknown) => sendEvent('close', event);

    emitter.on('bar',   onBar);
    emitter.on('fill',  onFill);
    emitter.on('close', onClose);

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
      emitter.off('bar',   onBar);
      emitter.off('fill',  onFill);
      emitter.off('close', onClose);
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
};

export default streamRoute;
