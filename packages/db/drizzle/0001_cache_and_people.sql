CREATE TABLE "cache_entries" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"fresh_until" timestamp with time zone NOT NULL,
	"stale_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "voice_actor_id" integer;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "voice_actor_image_url" text;--> statement-breakpoint
CREATE INDEX "cache_entries_stale_until_idx" ON "cache_entries" USING btree ("stale_until");--> statement-breakpoint
-- Donghua (e.g. Link Click) and other East Asian animation now count as anime.
UPDATE "media" SET "is_anime" = true WHERE "is_anime" = false AND "genres" @> '[{"id":16}]'::jsonb AND ("origin_countries" ?| array['JP','CN','TW','HK','KR'] OR "original_language" IN ('ja','zh','cn','ko'));
