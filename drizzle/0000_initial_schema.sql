-- Drizzle migration: 0000_initial_schema
-- Generated manually from src/shared/db/schema.ts

CREATE TABLE IF NOT EXISTS "bars" (
  "id" serial PRIMARY KEY,
  "symbol" text NOT NULL,
  "timeframe" text NOT NULL,
  "time" timestamp with time zone NOT NULL,
  "open" double precision NOT NULL,
  "high" double precision NOT NULL,
  "low" double precision NOT NULL,
  "close" double precision NOT NULL,
  "volume" double precision
);
CREATE UNIQUE INDEX IF NOT EXISTS "bars_symbol_tf_time_idx" ON "bars" ("symbol","timeframe","time");

CREATE TABLE IF NOT EXISTS "deals" (
  "id" serial PRIMARY KEY,
  "ticket" integer NOT NULL,
  "symbol" text NOT NULL,
  "type" text NOT NULL,
  "volume" double precision NOT NULL,
  "price" double precision NOT NULL,
  "profit" double precision NOT NULL,
  "swap" double precision NOT NULL,
  "commission" double precision NOT NULL,
  "time" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" serial PRIMARY KEY,
  "instance_id" text NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_type_ts_idx" ON "audit_events" ("type","timestamp");

CREATE TABLE IF NOT EXISTS "account_snapshots" (
  "id" serial PRIMARY KEY,
  "equity" double precision NOT NULL,
  "balance" double precision NOT NULL,
  "strategy" text,
  "asset_type" text,
  "trigger" text NOT NULL DEFAULT 'periodic',
  "timestamp" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "snapshots_strategy_idx" ON "account_snapshots" ("strategy","timestamp");
CREATE INDEX IF NOT EXISTS "snapshots_asset_type_idx" ON "account_snapshots" ("asset_type","timestamp");

CREATE TABLE IF NOT EXISTS "order_events" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL,
  "action" text NOT NULL,
  "order_type" text NOT NULL,
  "source" text,
  "symbol" text NOT NULL,
  "direction" text NOT NULL,
  "lots" real NOT NULL,
  "price" real NOT NULL,
  "limit_price" real,
  "metadata" jsonb,
  "timestamp" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "order_events_order_id_idx" ON "order_events" ("order_id");
CREATE INDEX IF NOT EXISTS "order_events_action_ts_idx" ON "order_events" ("action","created_at");
