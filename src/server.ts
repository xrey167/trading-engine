import { buildApp } from './app.js';

const app = await buildApp({ logger: true });

await app.listen({ port: 3000, host: '0.0.0.0' });

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  app.log.info({ signal }, 'Shutting down...');
  const forceExit = setTimeout(() => {
    app.log.error({ signal }, 'Forced exit after timeout');
    process.exit(1);
  }, 10_000);
  try {
    await app.close();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExit);
    app.log.error({ err, signal }, 'Error during shutdown');
    process.exit(1);
  }
};
process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)); });
process.on('SIGINT',  () => { shutdown('SIGINT').catch(() => process.exit(1)); });
