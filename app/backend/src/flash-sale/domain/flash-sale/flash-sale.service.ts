import { Injectable } from "@nestjs/common";
import { SaleWindowStatus } from "../../types/sale-status";
import { SaleStatus } from "./flash-sale.interface";

@Injectable()
export class FlashSaleService {
  getSaleStatus(): SaleStatus {
    return {
      status: SaleWindowStatus.UPCOMING,
      productName: "Limited Edition Product",
      productDescription: "Dummy response — not wired to real state yet.",
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      stockRemaining: 0,
      totalStock: 0,
    };
  }
}
