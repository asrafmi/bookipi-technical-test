import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const sales = pgTable("sales", {
  id: varchar("id", { length: 255 }).primaryKey(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productDescription: varchar("product_description", { length: 255 }).notNull(),
  totalStock: integer("total_stock").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
})

export type SaleRow = typeof sales.$inferSelect;
export type NewSaleRow = typeof sales.$inferInsert;