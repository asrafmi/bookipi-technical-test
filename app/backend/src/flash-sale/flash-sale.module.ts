import { Module } from "@nestjs/common";
import { FlashSaleController } from "src/flash-sale/application/rest/controller/flash-sale.controller";
import { FlashSaleService } from "src/flash-sale/domain/flash-sale/flash-sale.service";
import { ReconciliationService } from "src/flash-sale/domain/reconciliation/reconciliation.service";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { PurchaseQueueModule } from "src/flash-sale/infrastructure/queue/purchase-queue.module";

@Module({
  imports: [PurchaseQueueModule],
  controllers: [FlashSaleController],
  providers: [FlashSaleService, ReconciliationService, PurchaseRepository, SaleRepository, PurchaseGateway],
  exports: [FlashSaleService, PurchaseRepository, SaleRepository],
})
export class FlashSaleModule {}
