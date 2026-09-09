import { Module } from "@nestjs/common";
import ConfigModule from "./config/config.module";
import { DatabaseModule } from "./db/database.module";
import { FlashSaleModule } from "./flash-sale/flash-sale.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [ConfigModule, DatabaseModule, FlashSaleModule, RedisModule],
})
export class AppModule {}
