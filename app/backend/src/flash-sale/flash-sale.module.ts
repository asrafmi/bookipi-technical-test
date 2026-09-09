import { Module } from "@nestjs/common";
import { FlashSaleController } from "./application/rest/controller/flash-sale.controller";
import { FlashSaleService } from "./domain/flash-sale/flash-sale.service";
import { PurchaseRepository } from "./infrastructure/repository/purchase/purchase.repository";
import { SaleRepository } from "./infrastructure/repository/sale/sale.repository";
import { PurchaseGateway } from "./infrastructure/redis/purchase-gateway";
import { RedisModule } from "src/redis/redis.module";

@Module({
  controllers: [FlashSaleController],
  providers: [FlashSaleService, PurchaseRepository, SaleRepository, PurchaseGateway],
  exports: [FlashSaleService, PurchaseRepository, SaleRepository],
})
export class FlashSaleModule {}
