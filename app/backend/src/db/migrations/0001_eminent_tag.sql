CREATE TABLE "sales" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_description" varchar(255) NOT NULL,
	"total_stock" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;

INSERT INTO "sales" ("id", "product_name", "product_description", "total_stock", "starts_at", "ends_at")
VALUES (
  'default',
  'Messi Argentina 2026 Special Edition Jersey',
  'Limited commemorative run. Never restocked. One unit per person, while stock lasts.',
  100,
  '2026-09-10 00:00:00+00',
  '2026-09-10 23:59:59+00'
)
ON CONFLICT (id) DO NOTHING;
