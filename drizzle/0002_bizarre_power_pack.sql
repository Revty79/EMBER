CREATE TABLE "ember_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"acronym" text NOT NULL,
	"tone" text NOT NULL,
	"family_assistant_role" text NOT NULL,
	"privacy_boundaries" text NOT NULL,
	"response_style" text NOT NULL,
	"allowed_initiative" text NOT NULL,
	"forbidden_actions" text NOT NULL,
	"uncertainty_behavior" text NOT NULL,
	"memory_behavior" text NOT NULL,
	"additional_instructions" text DEFAULT '' NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ember_profiles" ADD CONSTRAINT "ember_profiles_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ember_profiles_updated_idx" ON "ember_profiles" USING btree ("updated_at");