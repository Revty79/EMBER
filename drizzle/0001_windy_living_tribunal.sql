ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "users"
SET "username" = lower(
  regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')
) || '_' || substring("id", 1, 8)
WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");
