import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { SaleWindowStatus } from "../../types/sale-status";
import { PurchaseResult, SaleStatus } from "./flash-sale.interface";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import awaitToError from "src/common/error/await-to-error";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";

const ERROR_MESSAGES: Record<PurchaseErrorCode, string> = {
  [PurchaseErrorCode.SALE_NOT_STARTED]: "The sale has not started yet.",
  [PurchaseErrorCode.SALE_ENDED]: "The sale has ended.",
  [PurchaseErrorCode.ALREADY_PURCHASED]: "You have already purchased this item.",
  [PurchaseErrorCode.SOLD_OUT]: "This item is sold out.",
  [PurchaseErrorCode.TEMPORARY_FAILURE]: "Something went wrong. Please try again.",
};

@Injectable()
export class FlashSaleService {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly purchaseGateway: PurchaseGateway,
  ) { }

  private failure(code: PurchaseErrorCode): PurchaseResult {
    return { accepted: false, code, message: ERROR_MESSAGES[code] };
  }

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

  async attemptPurchase(saleId: string, identifier: string): Promise<PurchaseResult> {
    const [errSale, sale] = await awaitToError(this.saleRepository.findById(saleId));
    if (errSale) throw new InternalServerErrorException("Failed to fetch sale status");
    if (!sale) throw new NotFoundException("Sale not found");

    const now = new Date();
    const gatewayResult = await this.purchaseGateway.attemptPurchase(saleId, identifier, now, sale.startsAt, sale.endsAt);
    if (!gatewayResult.accepted) return this.failure(gatewayResult.code);

    const [errPurchase, purchase] = await awaitToError(this.purchaseRepository.insertIfNotExists({
      saleId: saleId,
      identifier: identifier,
    }));
    if (errPurchase) {
      await this.purchaseGateway.compensate(saleId, identifier);
      return this.failure(PurchaseErrorCode.TEMPORARY_FAILURE);
    }
    if (!purchase) {
      return this.failure(PurchaseErrorCode.ALREADY_PURCHASED);
    }
    return { accepted: true, identifier: purchase.identifier, purchasedAt: purchase.createdAt.toISOString() };
  }
}
