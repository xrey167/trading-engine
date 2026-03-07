import type { Result } from '../lib/result.js';
import type { DomainError } from '../lib/errors.js';
import { ok, err } from '../lib/result.js';
import { notFound } from '../lib/errors.js';
import type { IService, ServiceKind, ServiceHealth } from './types.js';

export class ServiceRegistry {
  private readonly services = new Map<string, IService>();

  register(service: IService): void {
    if (this.services.has(service.id)) {
      throw new Error(`Service '${service.id}' is already registered`);
    }
    this.services.set(service.id, service);
  }

  unregister(id: string): boolean {
    return this.services.delete(id);
  }

  get(id: string): Result<IService, DomainError> {
    const svc = this.services.get(id);
    if (!svc) {
      return err(notFound(`Service '${id}' not found`, id));
    }
    return ok(svc);
  }

  getByKind(kind: ServiceKind): IService[] {
    return [...this.services.values()].filter(s => s.kind === kind);
  }

  list(): Array<{ id: string; kind: ServiceKind; name: string; status: string }> {
    return [...this.services.values()].map(s => ({
      id: s.id,
      kind: s.kind,
      name: s.name,
      status: s.health().status,
    }));
  }

  healthAll(): ServiceHealth[] {
    return [...this.services.values()].map(s => s.health());
  }

  async startAll(): Promise<void> {
    for (const svc of this.services.values()) {
      try {
        await svc.start();
      } catch (_e) {
        // Continue starting remaining services; the failed one is in Error state
      }
    }
  }

  async stopAll(): Promise<void> {
    const services = [...this.services.values()].reverse();
    for (const svc of services) {
      try {
        await svc.stop();
      } catch {
        // Best-effort stop
      }
    }
  }

  get size(): number {
    return this.services.size;
  }
}
