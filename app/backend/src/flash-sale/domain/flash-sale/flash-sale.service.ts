import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { SaleWindowStatus } from "src/flash-sale/types/sale-status";
import { PurchaseResult, SaleStatus } from "src/flash-sale/domain/flash-sale/flash-sale.interface";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { PurchasePersistenceQueue } from "src/flash-sale/infrastructure/queue/purchase-persistence.queue";
import awaitToError from "src/common/error/await-to-error";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";

const ERROR_MESSAGES: Record<PurchaseErrorCode, string> = {
  [PurchaseErrorCode.SALE_NOT_STARTED]: "The sale has not started yet.",
  [PurchaseErrorCode.SALE_ENDED]: "The sale has ended.",
  [PurchaseErrorCode.ALREADY_PURCHASED]: "You have already purchased this item.",
  [PurchaseErrorCode.SOLD_OUT]: "This item is sold out.",
  [PurchaseErrorCode.TEMPORARY_FAILURE]: "Something went wrong. Please try again.",
  [PurchaseErrorCode.NOT_PURCHASED]: "This user has not purchased an item in this sale.",
  [PurchaseErrorCode.PURCHASE_PENDING]: "Your purchase was accepted and is still being recorded. Please check again shortly.",
};

@Injectable()
export class FlashSaleService {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly purchaseGateway: PurchaseGateway,
    private readonly purchasePersistenceQueue: PurchasePersistenceQueue,
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

    // Read path only — never used to decide a purchase (see attemptPurchase).
    const stockRemaining = Math.max(sale.totalStock - sale.soldCount, 0);

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

    // Skip touching Postgres once the sale is already bootstrapped.
    const isBootstrapped = await this.purchaseGateway.isBootstrapped(saleId);
    if (!isBootstrapped) {
      const [errIdentifiers, identifiers] = await awaitToError(this.purchaseRepository.findIdentifiers(saleId));
      if (errIdentifiers) throw new InternalServerErrorException("Failed to fetch existing purchasers");
      await this.purchaseGateway.bootstrap(saleId, sale.totalStock, sale.soldCount, identifiers);
    }

    const now = new Date();
    const gatewayResult = await this.purchaseGateway.attemptPurchase(saleId, identifier, now, sale.startsAt, sale.endsAt);
    if (!gatewayResult.accepted) return this.failure(gatewayResult.code);

    // accepted: true means queued, not yet durable — see checkPurchaseStatus.
    const [errEnqueue] = await awaitToError(this.purchasePersistenceQueue.enqueue({ saleId, identifier }));
    if (errEnqueue) {
      await this.purchaseGateway.compensate(saleId, identifier);
      return this.failure(PurchaseErrorCode.TEMPORARY_FAILURE);
    }

    return { accepted: true, identifier, purchasedAt: now.toISOString() };
  }

  async checkPurchaseStatus(saleId: string, identifier: string): Promise<PurchaseResult> {
    const [errPurchase, purchase] = await awaitToError(this.purchaseRepository.findByIdentifier(saleId, identifier));
    if (errPurchase) throw new InternalServerErrorException("Failed to fetch purchase status");
    if (purchase) return { accepted: true, identifier: purchase.identifier, purchasedAt: purchase.createdAt.toISOString() };

    // Redis already holds the truth about who has a slot — the row just hasn't
    // landed yet. Distinguish that from never having purchased at all.
    const [errBuyer, isBuyer] = await awaitToError(this.purchaseGateway.isBuyer(saleId, identifier));
    if (errBuyer) throw new InternalServerErrorException("Failed to fetch purchase status");
    if (isBuyer) return this.failure(PurchaseErrorCode.PURCHASE_PENDING);

    return this.failure(PurchaseErrorCode.NOT_PURCHASED);
  }
}
