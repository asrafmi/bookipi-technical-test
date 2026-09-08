import { Module } from "@nestjs/common";
import ConfigModule from "./config/config.module";
import { FlashSaleModule } from "./flash-sale/flash-sale.module";

@Module({
  imports: [ConfigModule, FlashSaleModule],
})
export class AppModule {}
