import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sales } from "../sale/sale.entity";

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: varchar("sale_id", { length: 255 })
      .notNull()
      .references(() => sales.id),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("purchases_sale_id_identifier_idx").on(table.saleId, table.identifier)],
);

export type PurchaseRow = typeof purchases.$inferSelect;
export type NewPurchaseRow = typeof purchases.$inferInsert;
