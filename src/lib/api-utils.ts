// Fastify route-handler middleware utilities — ported from quant-lib/api
import type { FastifyRequest, FastifyReply } from 'fastify';
import { invalidInput, unauthorized, type DomainError } from './errors.js';
import type { Result } from './result.js';
import { ok, err, isErr } from './result.js';

/** Map a DomainError to an HTTP status code. */
function statusForError(e: DomainError): number {
  switch (e.type) {
    case 'NOT_FOUND':        return 404;
    case 'INVALID_INPUT':    return 400;
    case 'UNAUTHORIZED':     return 401;
    case 'BUSINESS_RULE':    return 422;
    case 'NOT_IMPLEMENTED':  return 501;
    case 'INSUFFICIENT_DATA': return 422;
    case 'GATEWAY_ERROR':    return 502;
    default:                 return 500;
  }
}

/**
 * Wrap a Fastify route handler so that a returned `Result<T, DomainError>`
 * is automatically serialised: `ok` → 200 + body, `err` → HTTP error.
 *
 * Usage:
 *   fastify.get('/foo', withErrorHandler(async (req, reply) => {
 *     const result = await someUseCase.execute();
 *     return result;   // Result<T, DomainError>
 *   }));
 */
export function withErrorHandler<T>(
  handler: (req: FastifyRequest, reply: FastifyReply) => Promise<Result<T, DomainError>>,
) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await handler(req, reply);
    if (isErr(result)) {
      const status = statusForError(result.error);
      reply.status(status).send({ error: result.error });
      return;
    }
    reply.send(result.value);
  };
}

/**
 * Parse a query-string date parameter.
 * Returns a `DomainError` if the value is missing or not a valid date.
 *
 * Note: V8's Date constructor silently wraps out-of-range values (e.g. month 13
 * rolls over to the next year). Callers that need strict ISO-8601 validation
 * should apply additional checks after parsing.
 */
export function parseQueryDate(s: string | undefined, name: string): Result<Date, DomainError> {
  if (!s) {
    return err(invalidInput(`Missing required query param: ${name}`, name));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return err(invalidInput(`Invalid date for '${name}': ${s}`, name));
  }
  return ok(d);
}

/**
 * Validate the `x-api-key` header against the configured secret.
 * Returns an UNAUTHORIZED DomainError (→ HTTP 401) when the key is missing or
 * does not match.
 *
 * Throws if `expectedKey` is empty — this indicates a misconfigured environment
 * and should never reach production.
 */
export function requireApiKey(
  req: FastifyRequest,
  expectedKey: string,
): Result<void, DomainError> {
  if (!expectedKey) throw new Error('BUG: requireApiKey called with empty expectedKey');
  const provided = (req.headers['x-api-key'] as string | undefined) ?? '';
  if (provided !== expectedKey) {
    return err(unauthorized('Unauthorized — invalid or missing API key'));
  }
  return ok(undefined);
}

/**
 * Fastify preHandler hook that enforces `x-api-key` auth.
 * Reads the expected key from `process.env.API_KEY`.
 * When `API_KEY` is not set (e.g. in tests), the hook is a no-op.
 */
export async function apiKeyPreHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const expectedKey = process.env.API_KEY;
  if (!expectedKey) return;                       // no key configured → skip auth
  const result = requireApiKey(req, expectedKey);
  if (isErr(result)) {
    const status = statusForError(result.error);
    reply.status(status).send({ error: result.error });
  }
}
