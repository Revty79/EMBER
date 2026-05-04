CREATE TABLE "minecraft_bridge_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mode" text NOT NULL,
	"observation_timestamp" text,
	"bot_username" text,
	"observation_json" text NOT NULL,
	"observation_summary" text,
	"model" text,
	"response_mode" text,
	"prompt_text" text,
	"shadow_reply" text,
	"would_do" text,
	"confidence" text,
	"requested_actions_json" text,
	"executed" boolean DEFAULT false NOT NULL,
	"accepted_by_body" boolean,
	"body_result_json" text,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "minecraft_bridge_logs_created_idx" ON "minecraft_bridge_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "minecraft_bridge_logs_mode_created_idx" ON "minecraft_bridge_logs" USING btree ("mode","created_at");