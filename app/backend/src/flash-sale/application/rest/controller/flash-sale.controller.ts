import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { FlashSaleService } from "../../../domain/flash-sale/flash-sale.service";
import { GetSaleStatusResponse } from "../response/get-sale-status.response";

@Controller()
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Get("/v1/flash-sale/:saleId/status")
  @ApiOperation({ summary: "Get the current flash sale status" })
  @ApiOkResponse({ type: GetSaleStatusResponse })
  async getStatus(@Param("saleId") saleId: string): Promise<GetSaleStatusResponse> {
    return await this.flashSaleService.getSaleStatus(saleId);
  }
}
