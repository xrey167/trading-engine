import { Value } from '@sinclair/typebox/value';
import type { Logger } from '../../shared/lib/logger.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { ok, err } from '../../shared/lib/result.js';
import { invalidInput } from '../../shared/lib/errors.js';
import { MoneyManagementFactoryConfigSchema, type MoneyManagementFactoryConfig } from '../types.js';

export class CreateMoneyManagementUseCase {
  constructor(private readonly logger: Logger) {}

  execute(rawConfig: unknown): Result<MoneyManagementFactoryConfig, DomainError> {
    if (!Value.Check(MoneyManagementFactoryConfigSchema, rawConfig)) {
      const errors = [...Value.Errors(MoneyManagementFactoryConfigSchema, rawConfig)];
      const message = errors.map(e => `${e.path}: ${e.message}`).join('; ');
      this.logger.warn(`CreateMoneyManagement: validation failed ${message}`);
      return err(invalidInput(message));
    }
    this.logger.debug(`CreateMoneyManagement: config valid symbol=${(rawConfig as MoneyManagementFactoryConfig).symbol}`);
    return ok(rawConfig as MoneyManagementFactoryConfig);
  }
}
