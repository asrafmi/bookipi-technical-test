import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import ConfigModule from "src/config/config.module";
import ConfigService from "src/config/config.service";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { PURCHASE_PERSISTENCE_QUEUE } from "src/flash-sale/infrastructure/queue/purchase-persistence.job";
import { PurchasePersistenceQueue } from "src/flash-sale/infrastructure/queue/purchase-persistence.queue";
import { PurchasePersistenceProcessor } from "src/flash-sale/infrastructure/queue/purchase-persistence.processor";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      // maxRetriesPerRequest: null is required by BullMQ's blocking worker connection.
      useFactory: (configService: ConfigService) => ({
        connection: { ...configService.redis(), maxRetriesPerRequest: null },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: PURCHASE_PERSISTENCE_QUEUE }),
  ],
  // Redeclared here too since the worker needs them and Nest can't reach back into an importer's providers.
  providers: [PurchasePersistenceQueue, PurchasePersistenceProcessor, PurchaseRepository, PurchaseGateway],
  exports: [PurchasePersistenceQueue],
})
export class PurchaseQueueModule {}
