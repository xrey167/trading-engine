// ─── Event Catalog HTTP routes ────────────────────────────────────────────────
//
// GET /v1/events          — query EventDefinitions (filtered)
// GET /v1/events/:id      — get a single EventDefinition by id

import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ErrorResponseSchema } from '../../schemas/common.js';
import { getEventById, queryEvents } from './catalog.js';
import type { EventQuery } from './catalog.js';

// ─── Response schema ─────────────────────────────────────────────────────────

const EventDefinitionSchema = Type.Object({
  id:          Type.String(),
  name:        Type.String(),
  type:        Type.Number(),
  sector:      Type.Number(),
  domain:      Type.Number(),
  importance:  Type.Number(),
  frequency:   Type.Number(),
  timeMode:    Type.Number(),
  currency:    Type.String(),
  unit:        Type.Number(),
  multiplier:  Type.Number(),
  digits:      Type.Number(),
  countryCode: Type.Optional(Type.String()),
  countryId:   Type.Optional(Type.Number()),
  description: Type.Optional(Type.String()),
  externalIds: Type.Optional(Type.Object({
    numericId:  Type.Optional(Type.Number()),
    slug:       Type.Optional(Type.String()),
    eventCode:  Type.Optional(Type.String()),
  })),
});

// ─── Query string schema ─────────────────────────────────────────────────────

const EventQuerystringSchema = Type.Object({
  domain:      Type.Optional(Type.String()),
  sector:      Type.Optional(Type.String()),
  importance:  Type.Optional(Type.String()),
  currency:    Type.Optional(Type.String()),
  countryCode: Type.Optional(Type.String()),
  type:        Type.Optional(Type.String()),
  search:      Type.Optional(Type.String()),
});

// ─── Route handlers ──────────────────────────────────────────────────────────

const eventsRoute: FastifyPluginAsync = async (fastify) => {

  // GET /v1/events
  fastify.get('/v1/events', {
    schema: {
      querystring: EventQuerystringSchema,
      response: { 200: Type.Array(EventDefinitionSchema) },
    },
  }, async (request) => {
    const q = request.query as {
      domain?: string; sector?: string; importance?: string;
      currency?: string; countryCode?: string; type?: string; search?: string;
    };

    const filter: EventQuery = {};

    if (q.domain !== undefined) {
      const parts = q.domain.split(',').map(Number);
      filter.domain = parts.length === 1 ? parts[0] as EventQuery['domain'] : parts as EventQuery['domain'];
    }
    if (q.sector !== undefined) {
      const parts = q.sector.split(',').map(Number);
      filter.sector = parts.length === 1 ? parts[0] as EventQuery['sector'] : parts as EventQuery['sector'];
    }
    if (q.importance !== undefined) {
      filter.importance = Number(q.importance) as EventQuery['importance'];
    }
    if (q.currency !== undefined) {
      const parts = q.currency.split(',');
      filter.currency = parts.length === 1 ? parts[0] : parts;
    }
    if (q.countryCode !== undefined) {
      const parts = q.countryCode.split(',');
      filter.countryCode = parts.length === 1 ? parts[0] : parts;
    }
    if (q.type !== undefined) {
      const parts = q.type.split(',').map(Number);
      filter.type = parts.length === 1 ? parts[0] as EventQuery['type'] : parts as EventQuery['type'];
    }
    if (q.search !== undefined) {
      filter.search = q.search;
    }

    return queryEvents(filter);
  });

  // GET /v1/events/:id
  fastify.get('/v1/events/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: EventDefinitionSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const def = getEventById(id);
    if (!def) {
      return reply.status(404).send({ error: `Event '${id}' not found` });
    }
    return def;
  });
};

export default eventsRoute;
