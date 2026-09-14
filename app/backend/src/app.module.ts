import { Module } from "@nestjs/common";
import ConfigModule from "./config/config.module";
import { DatabaseModule } from "./db/database.module";
import { FlashSaleModule } from "./flash-sale/flash-sale.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";
import { ReconciliationModule } from "./flash-sale/domain/reconciliation/reconciliation.module";

@Module({
  imports: [ConfigModule, DatabaseModule, FlashSaleModule, HealthModule, RedisModule, ReconciliationModule],
})
export class AppModule {}
