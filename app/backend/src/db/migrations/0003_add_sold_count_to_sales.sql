ALTER TABLE "sales" ADD COLUMN "sold_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill existing rows from the purchases ledger.
UPDATE "sales" s
SET "sold_count" = (SELECT COUNT(*) FROM "purchases" p WHERE p."sale_id" = s."id");