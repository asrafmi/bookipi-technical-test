import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import awaitToError from "src/common/error/await-to-error";
import { DRIZZLE_CLIENT } from "src/db/database.module";
import { DrizzleClient } from "src/db/client";
import { sales } from "src/flash-sale/infrastructure/repository/sale/sale.entity";
import { NewPurchaseRow, purchases, PurchaseRow } from "./purchase.entity";

@Injectable()
export class PurchaseRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  findByIdentifier(saleId: string, identifier: string) {
    return this.db.query.purchases.findFirst({
      where: and(eq(purchases.saleId, saleId), eq(purchases.identifier, identifier)),
    });
  }

  count(saleId: string) {
    return this.db.$count(purchases, eq(purchases.saleId, saleId));
  }

  // Insert and the sold_count bump happen in one transaction so they never drift apart.
  async insertIfNotExists(input: NewPurchaseRow): Promise<PurchaseRow | null> {
    const [err, result] = await awaitToError(
      this.db.transaction(async (tx) => {
        const inserted = await tx.insert(purchases).values(input).onConflictDoNothing().returning();
        const purchase = inserted[0] ?? null; // empty array = already purchased
        if (purchase) {
          await tx
            .update(sales)
            .set({ soldCount: sql`${sales.soldCount} + 1` })
            .where(eq(sales.id, input.saleId));
        }
        return purchase;
      }),
    );
    if (err) throw err;
    return result;
  }
}
