import { Module } from "@nestjs/common";
import { FlashSaleController } from "./application/rest/controller/flash-sale.controller";
import { FlashSaleService } from "./domain/flash-sale/flash-sale.service";
import { PurchaseRepository } from "./infrastructure/repository/purchase/purchase.repository";

@Module({
  controllers: [FlashSaleController],
  providers: [FlashSaleService, PurchaseRepository],
  exports: [FlashSaleService, PurchaseRepository],
})
export class FlashSaleModule {}
