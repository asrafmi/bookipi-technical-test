import { ApiProperty } from "@nestjs/swagger";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";

export class AttemptPurchaseResponse {
  @ApiProperty()
  accepted!: boolean;

  @ApiProperty({ required: false })
  identifier?: string;

  @ApiProperty({ required: false })
  purchasedAt?: string;

  @ApiProperty({ required: false, enum: Object.values(PurchaseErrorCode) })
  code?: PurchaseErrorCode;

  @ApiProperty({ required: false })
  message?: string;
}
