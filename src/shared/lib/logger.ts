/**
 * Minimal Logger interface — strategies and services depend on this contract.
 */
export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

/** Silent logger for tests. */
export const nullLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/** Console-backed logger. */
export const consoleLogger: Logger = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/**
 * Adapt a Fastify-style logger (pino) to our minimal Logger interface.
 * Fastify's logger uses (msg, ...args) but also supports object-first overloads.
 * This adapter normalises calls to our string-first contract.
 */
export function toLogger(log: { debug: (...args: unknown[]) => void; info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void }): Logger {
  return {
    debug: (msg, ...args) => log.debug(msg, ...args),
    info: (msg, ...args) => log.info(msg, ...args),
    warn: (msg, ...args) => log.warn(msg, ...args),
    error: (msg, ...args) => log.error(msg, ...args),
  };
}

/** Factory: create a named logger backed by console. */
export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;
  return {
    debug: (...args: unknown[]) => console.debug(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}
