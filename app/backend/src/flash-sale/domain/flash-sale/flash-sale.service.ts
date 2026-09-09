import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { SaleWindowStatus } from "../../types/sale-status";
import { SaleStatus } from "./flash-sale.interface";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import awaitToError from "src/common/error/await-to-error";

@Injectable()
export class FlashSaleService {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly purchaseGateway: PurchaseGateway,
  ) {}

  private resolveWindowStatus(now: Date, startsAt: Date, endsAt: Date): SaleWindowStatus {
    if (now < startsAt) return SaleWindowStatus.UPCOMING;
    if (now > endsAt) return SaleWindowStatus.ENDED;
    return SaleWindowStatus.ACTIVE;
  }

  async getSaleStatus(saleId: string): Promise<SaleStatus> {
    const [errSale, sale] = await awaitToError(this.saleRepository.findById(saleId));
    if (errSale) throw new InternalServerErrorException("Failed to fetch sale status");
    if (!sale) throw new NotFoundException("Sale not found");

    const now = new Date();
    const status = this.resolveWindowStatus(now, sale.startsAt, sale.endsAt);

    const [errCount, purchasedCount] = await awaitToError(this.purchaseRepository.count(saleId));
    if (errCount) throw new InternalServerErrorException("Failed to fetch purchase count");

    const stockRemaining = Math.max(sale.totalStock - purchasedCount, 0);

    return {
      status: status,
      productName: sale.productName,
      productDescription: sale.productDescription,
      startsAt: sale.startsAt.toISOString(),
      endsAt: sale.endsAt.toISOString(),
      stockRemaining: stockRemaining,
      totalStock: sale.totalStock,
    };
  }
}
