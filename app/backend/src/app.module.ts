import { Module } from "@nestjs/common";
import ConfigModule from "./config/config.module";
import { DatabaseModule } from "./db/database.module";
import { FlashSaleModule } from "./flash-sale/flash-sale.module";

@Module({
  imports: [ConfigModule, DatabaseModule, FlashSaleModule],
})
export class AppModule {}
