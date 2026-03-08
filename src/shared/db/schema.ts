import { pgTable, serial, text, doublePrecision, real, timestamp, jsonb, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const bars = pgTable('bars', {
  id:        serial('id').primaryKey(),
  symbol:    text('symbol').notNull(),
  timeframe: text('timeframe').notNull(),
  time:      timestamp('time', { withTimezone: true }).notNull(),
  open:      doublePrecision('open').notNull(),
  high:      doublePrecision('high').notNull(),
  low:       doublePrecision('low').notNull(),
  close:     doublePrecision('close').notNull(),
  volume:    doublePrecision('volume'),
}, (t) => [
  uniqueIndex('bars_symbol_tf_time_idx').on(t.symbol, t.timeframe, t.time),
]);

export const deals = pgTable('deals', {
  id:         serial('id').primaryKey(),
  ticket:     integer('ticket').notNull(),
  symbol:     text('symbol').notNull(),
  type:       text('type').notNull(),
  volume:     doublePrecision('volume').notNull(),
  price:      doublePrecision('price').notNull(),
  profit:     doublePrecision('profit').notNull(),
  swap:       doublePrecision('swap').notNull(),
  commission: doublePrecision('commission').notNull(),
  time:       timestamp('time', { withTimezone: true }).notNull(),
});

export const auditEvents = pgTable('audit_events', {
  id:         serial('id').primaryKey(),
  instanceId: text('instance_id').notNull(),
  type:       text('type').notNull(),
  payload:    jsonb('payload').notNull(),
  timestamp:  timestamp('timestamp', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('audit_type_ts_idx').on(t.type, t.timestamp),
]);

export const accountSnapshots = pgTable('account_snapshots', {
  id:        serial('id').primaryKey(),
  equity:    doublePrecision('equity').notNull(),
  balance:   doublePrecision('balance').notNull(),
  strategy:  text('strategy'),
  assetType: text('asset_type'),
  trigger:   text('trigger').notNull().default('periodic'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('snapshots_strategy_idx').on(t.strategy, t.timestamp),
  index('snapshots_asset_type_idx').on(t.assetType, t.timestamp),
]);

export const orderEvents = pgTable('order_events', {
  id:         serial('id').primaryKey(),
  orderId:    integer('order_id').notNull(),
  action:     text('action').notNull(),
  orderType:  text('order_type').notNull(),
  source:     text('source'),
  symbol:     text('symbol').notNull(),
  direction:  text('direction').notNull(),
  lots:       real('lots').notNull(),
  price:      real('price').notNull(),
  limitPrice: real('limit_price'),
  metadata:   jsonb('metadata'),
  timestamp:  text('timestamp').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('order_events_order_id_idx').on(t.orderId),
  index('order_events_action_ts_idx').on(t.action, t.createdAt),
]);

export type OrderEventRow = typeof orderEvents.$inferInsert;
