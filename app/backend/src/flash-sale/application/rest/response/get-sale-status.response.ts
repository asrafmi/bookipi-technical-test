import { ApiProperty } from "@nestjs/swagger";
import { SaleWindowStatus } from "../../../types/sale-status";

export class GetSaleStatusResponse {
  @ApiProperty({ enum: Object.values(SaleWindowStatus) })
  status!: SaleWindowStatus;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  productDescription!: string;

  @ApiProperty()
  startsAt!: string;

  @ApiProperty()
  endsAt!: string;

  @ApiProperty()
  stockRemaining!: number;

  @ApiProperty()
  totalStock!: number;
}
