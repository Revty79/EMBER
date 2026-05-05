CREATE TABLE "minecraft_bridge_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"shadow_enabled" boolean DEFAULT false NOT NULL,
	"shadow_store_observations" boolean DEFAULT true NOT NULL,
	"shadow_chat_summary" boolean DEFAULT false NOT NULL,
	"shadow_observation_interval_ms" integer DEFAULT 180000 NOT NULL,
	"shadow_timeout_ms" integer DEFAULT 180000 NOT NULL,
	"bridge_debug" boolean DEFAULT false NOT NULL,
	"supervised_enabled" boolean DEFAULT false NOT NULL,
	"ai_bridge_enabled" boolean DEFAULT false NOT NULL,
	"task_system_enabled" boolean DEFAULT true NOT NULL,
	"allow_eating" boolean DEFAULT true NOT NULL,
	"allow_equip" boolean DEFAULT true NOT NULL,
	"allow_flee" boolean DEFAULT true NOT NULL,
	"allow_mining" boolean DEFAULT true NOT NULL,
	"allow_harvest" boolean DEFAULT true NOT NULL,
	"allow_wander" boolean DEFAULT true NOT NULL,
	"allow_crop_harvest" boolean DEFAULT false NOT NULL,
	"allow_combat" boolean DEFAULT false NOT NULL,
	"allow_building" boolean DEFAULT false NOT NULL,
	"allow_crafting" boolean DEFAULT false NOT NULL,
	"allow_containers" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE INDEX "minecraft_bridge_settings_updated_idx" ON "minecraft_bridge_settings" USING btree ("updated_at");