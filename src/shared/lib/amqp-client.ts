import amqplib from 'amqplib';
import type { Logger } from './logger.js';

export interface AmqpClient {
  readonly connection: amqplib.ChannelModel;
  readonly channel: amqplib.ConfirmChannel;
}

export async function createAmqpClient(
  logger: Logger,
  opts?: { url?: string; heartbeat?: number },
): Promise<AmqpClient | null> {
  const url = opts?.url ?? process.env.RABBITMQ_URL;
  if (!url) return null;

  let connection: amqplib.ChannelModel;
  try {
    connection = await amqplib.connect(url, { heartbeat: opts?.heartbeat ?? 30 });
  } catch (err) {
    logger.error('AMQP connection failed — starting without AMQP', err);
    return null;
  }

  connection.on('error', (err) => logger.error('AMQP connection error', err));
  connection.on('close', () => logger.warn('AMQP connection closed'));

  let channel: amqplib.ConfirmChannel;
  try {
    channel = await connection.createConfirmChannel();
  } catch (err) {
    logger.error('AMQP confirm channel creation failed', err);
    try { await connection.close(); } catch { /* ignore */ }
    return null;
  }

  logger.info('AMQP connected (confirm channel ready)');
  return { connection, channel };
}

export async function closeAmqpClient(client: AmqpClient, logger: Logger): Promise<void> {
  try {
    await client.channel.close();
  } catch { /* already closed */ }
  try {
    await client.connection.close();
  } catch { /* already closed */ }
  logger.info('AMQP client closed');
}
