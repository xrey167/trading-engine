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

  const connection = await amqplib.connect(url, {
    heartbeat: opts?.heartbeat ?? 30,
  });

  connection.on('error', (err) => logger.error(`AMQP connection error: ${err.message}`));
  connection.on('close', () => logger.warn('AMQP connection closed'));

  const channel = await connection.createConfirmChannel();
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
