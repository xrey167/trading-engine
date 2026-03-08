import { buildApp } from './app.js';

const app = await buildApp({ logger: true });

await app.listen({ port: 3000, host: '0.0.0.0' });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down...');
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
