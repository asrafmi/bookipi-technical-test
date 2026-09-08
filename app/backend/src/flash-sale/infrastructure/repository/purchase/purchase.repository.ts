import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import awaitToError from "../../../../common/error/await-to-error";
import { DRIZZLE_CLIENT } from "../../../../db/database.module";
import { DrizzleClient } from "../../../../db/client";
import { NewPurchaseRow, purchases } from "./purchase.entity";

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

  async insertIfNotExists(input: NewPurchaseRow) {
    const [err, result] = await awaitToError(
      this.db.insert(purchases).values(input).onConflictDoNothing().returning(),
    );
    if (err) throw err;
    return result[0] ?? null; // empty array = the unique constraint already held one — that's the "already purchased" case
  }
}
