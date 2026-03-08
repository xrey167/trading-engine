CREATE TABLE "account_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"equity" double precision NOT NULL,
	"balance" double precision NOT NULL,
	"strategy" text,
	"asset_type" text,
	"trigger" text DEFAULT 'periodic' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bars" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket" integer NOT NULL,
	"symbol" text NOT NULL,
	"type" text NOT NULL,
	"volume" double precision NOT NULL,
	"price" double precision NOT NULL,
	"profit" double precision NOT NULL,
	"swap" double precision NOT NULL,
	"commission" double precision NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"canonical_id" uuid
);
--> statement-breakpoint
CREATE TABLE "event_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"instance_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"canonical_id" uuid,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "snapshots_strategy_idx" ON "account_snapshots" USING btree ("strategy","timestamp");--> statement-breakpoint
CREATE INDEX "snapshots_asset_type_idx" ON "account_snapshots" USING btree ("asset_type","timestamp");--> statement-breakpoint
CREATE INDEX "audit_type_ts_idx" ON "audit_events" USING btree ("type","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "bars_symbol_tf_time_idx" ON "bars" USING btree ("symbol","timeframe","time");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_events_action_ts_idx" ON "order_events" USING btree ("action","created_at");