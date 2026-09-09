import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm/sql/expressions/conditions";
import { DrizzleClient } from "src/db/client";
import { DRIZZLE_CLIENT } from "src/db/database.module";
import { sales } from "src/flash-sale/infrastructure/repository/sale/sale.entity";

@Injectable()
export class SaleRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) { }

  findById(saleId: string) {
    return this.db.query.sales.findFirst({
      where: eq(sales.id, saleId),
    })
  }
}