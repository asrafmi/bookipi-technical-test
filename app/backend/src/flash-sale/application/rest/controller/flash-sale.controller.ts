import { Body, Controller, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { FlashSaleService } from "src/flash-sale/domain/flash-sale/flash-sale.service";
import { GetSaleStatusResponse } from "src/flash-sale/application/rest/response/get-sale-status.response";
import { AttemptPurchaseRequest } from "src/flash-sale/application/rest/request/attempt-purchase.request";
import { AttemptPurchaseResponse } from "src/flash-sale/application/rest/response/attempt-purchase.response";
import { PurchaseErrorHttpStatus } from "src/flash-sale/types/purchase";

@Controller()
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Get("/v1/flash-sale/:saleId/status")
  @ApiOperation({ summary: "Get the current flash sale status" })
  @ApiOkResponse({ type: GetSaleStatusResponse })
  async getStatus(@Param("saleId") saleId: string): Promise<GetSaleStatusResponse> {
    return await this.flashSaleService.getSaleStatus(saleId);
  }

  @Post("/v1/flash-sale/:saleId/purchase")
  @HttpCode(200)
  @ApiOperation({ summary: "Attempt to purchase the flash sale item" })
  @ApiOkResponse({ type: AttemptPurchaseResponse })
  async attemptPurchase(
    @Param("saleId") saleId: string,
    @Body() body: AttemptPurchaseRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AttemptPurchaseResponse> {
    const result = await this.flashSaleService.attemptPurchase(saleId, body.identifier);
    if (!result.accepted) res.status(PurchaseErrorHttpStatus[result.code]);
    return result;
  }

  @Get("/v1/flash-sale/:saleId/purchase/:identifier")
  @ApiOperation({ summary: "Check whether this identifier has secured an item" })
  @ApiOkResponse({ type: AttemptPurchaseResponse })
  async checkPurchaseStatus(
    @Param("saleId") saleId: string,
    @Param("identifier") identifier: string,
  ): Promise<AttemptPurchaseResponse> {
    return await this.flashSaleService.checkPurchaseStatus(saleId, identifier);
  }
}
