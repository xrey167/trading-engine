import type { FastifyPluginAsync } from 'fastify';
import { WebSocket } from '@fastify/websocket';

const streamRoute: FastifyPluginAsync = async (fastify) => {
  // GET /stream — WebSocket real-time event stream
  fastify.get('/stream', { websocket: true }, (socket) => {
    const { emitter } = fastify;

    const onEvent = (event: unknown) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    };

    emitter.on('bar',   onEvent);
    emitter.on('fill',  onEvent);
    emitter.on('close', onEvent);

    const cleanup = () => {
      emitter.off('bar',   onEvent);
      emitter.off('fill',  onEvent);
      emitter.off('close', onEvent);
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
};

export default streamRoute;
