import { Module } from "@nestjs/common";
import { FlashSaleController } from "./application/rest/controller/flash-sale.controller";
import { FlashSaleService } from "./domain/flash-sale/flash-sale.service";

@Module({
  controllers: [FlashSaleController],
  providers: [FlashSaleService],
  exports: [FlashSaleService],
})
export class FlashSaleModule {}
