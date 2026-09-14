import { Module } from "@nestjs/common";
import ConfigModule from "src/config/config.module";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { ReconciliationService } from "src/flash-sale/domain/reconciliation/reconciliation.service";

@Module({
  imports: [ConfigModule],
  providers: [ReconciliationService, SaleRepository, PurchaseGateway],
})
export class ReconciliationModule {}
