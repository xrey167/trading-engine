import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nullLogger } from './logger.js';

const mockChannel = {
  close: vi.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  on: vi.fn(),
  createConfirmChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn(),
  },
}));

import { createAmqpClient, closeAmqpClient } from './amqp-client.js';
import amqplib from 'amqplib';

describe('createAmqpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(amqplib.connect).mockResolvedValue(mockConnection as any);
    delete process.env.RABBITMQ_URL;
  });

  afterEach(() => {
    delete process.env.RABBITMQ_URL;
  });

  it('returns null when no URL provided', async () => {
    const result = await createAmqpClient(nullLogger);
    expect(result).toBeNull();
  });

  it('connects with opts.url', async () => {
    const result = await createAmqpClient(nullLogger, { url: 'amqp://localhost:5672' });

    expect(amqplib.connect).toHaveBeenCalledWith('amqp://localhost:5672', { heartbeat: 30 });
    expect(result).not.toBeNull();
    expect(result!.connection).toBe(mockConnection);
    expect(result!.channel).toBe(mockChannel);
  });

  it('connects with RABBITMQ_URL env var', async () => {
    process.env.RABBITMQ_URL = 'amqp://envhost:5672';
    const result = await createAmqpClient(nullLogger);

    expect(amqplib.connect).toHaveBeenCalledWith('amqp://envhost:5672', { heartbeat: 30 });
    expect(result).not.toBeNull();
  });

  it('closeAmqpClient closes channel then connection', async () => {
    const client = { connection: mockConnection as any, channel: mockChannel as any };
    await closeAmqpClient(client, nullLogger);

    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();

    const channelCloseOrder = mockChannel.close.mock.invocationCallOrder[0];
    const connCloseOrder = mockConnection.close.mock.invocationCallOrder[0];
    expect(channelCloseOrder).toBeLessThan(connCloseOrder);
  });
});
