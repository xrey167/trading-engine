import type { Logger } from '../../shared/lib/logger.js';
import type { ISignalStrategy } from './types.js';
import { CandleAtrStrategy } from './candle-atr.js';
import { VolumeBreakoutStrategy } from './volume-breakout.js';

type StrategyCreator = (cfg: Record<string, unknown>, log: Logger) => ISignalStrategy;

const registry = new Map<string, StrategyCreator>();

export function registerStrategy(name: string, creator: StrategyCreator): void {
  registry.set(name, creator);
}

export function createStrategy(name: string | undefined, log: Logger): ISignalStrategy {
  const resolved = name ?? 'CandleAtr';
  const creator = registry.get(resolved);
  if (!creator) throw new Error(`Unknown strategy: ${resolved}`);
  return creator({}, log);
}

// Default registrations
registerStrategy('CandleAtr', (cfg, log) => new CandleAtrStrategy(cfg, log));
registerStrategy('VolumeBreakout', (cfg, log) => new VolumeBreakoutStrategy(cfg, log));
