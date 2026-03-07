// BrokerRegistry — ported from quant-lib/infrastructure
//
// A lightweight registry that maps broker adapter names to factory functions.
// At startup, register the adapters you want; then resolve by name.
//
// Usage:
//   BrokerRegistry.register('paper', () => new PaperBroker(emitter));
//   BrokerRegistry.register('mt5',   (url) => new MT5AccountGateway(url));
//   const broker = BrokerRegistry.resolve<IAccountGateway>('mt5', bridgeUrl);

import type { IFullBrokerAdapter } from './types.js';
import type { Result } from '../shared/lib/result.js';
import { ok, err } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import { notFound } from '../shared/lib/errors.js';

export type BrokerFactory<T = IFullBrokerAdapter> = (config?: unknown) => T;

const _registry = new Map<string, BrokerFactory>();

/**
 * Static factory registry: maps adapter names to factory functions.
 * Use this when you want to create fresh adapter instances on demand by name
 * (e.g. in tests, multi-tenant setups, or lazy initialisation).
 *
 * For managing already-constructed live adapter instances, use `BrokerRegistry`.
 */
export const BrokerAdapterFactory = {
  /**
   * Register a named factory.
   * Overwrites any previous registration for the same name.
   */
  register<T = IFullBrokerAdapter>(name: string, factory: BrokerFactory<T>): void {
    _registry.set(name, factory as BrokerFactory);
  },

  /**
   * Create an adapter instance by name.
   * Throws if the name was never registered.
   */
  create<T = IFullBrokerAdapter>(name: string, config?: unknown): T {
    const factory = _registry.get(name);
    if (!factory) {
      throw new Error(
        `BrokerAdapterFactory: unknown adapter '${name}'. Registered: [${[..._registry.keys()].join(', ')}]`,
      );
    }
    return factory(config) as T;
  },

  /** List all registered adapter names. */
  list(): string[] {
    return [..._registry.keys()];
  },
};

/**
 * Instance registry: holds already-constructed adapter instances keyed by name.
 * Use this at runtime when adapters are long-lived singletons (e.g. the paper
 * broker and MT5 gateway wired up at startup).
 *
 * For creating fresh instances on demand, use `BrokerAdapterFactory`.
 */
export class BrokerRegistry {
  private readonly adapters = new Map<string, IFullBrokerAdapter>();

  /**
   * Register a live adapter instance under a logical name (e.g. 'paper', 'mt5').
   */
  register(name: string, adapter: IFullBrokerAdapter): void {
    this.adapters.set(name, adapter);
  }

  /**
   * Resolve a registered adapter by name.
   * Returns a NOT_FOUND DomainError if the adapter was never registered.
   */
  resolve(name: string): Result<IFullBrokerAdapter, DomainError> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      return err(
        notFound(
          `BrokerRegistry: adapter '${name}' not registered. Available: [${[...this.adapters.keys()].join(', ')}]`,
          name,
        ),
      );
    }
    return ok(adapter);
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }
}
