CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" varchar(255) NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_sale_id_identifier_idx" ON "purchases" USING btree ("sale_id","identifier");