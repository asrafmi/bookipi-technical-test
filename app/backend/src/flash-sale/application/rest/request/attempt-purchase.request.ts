import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AttemptPurchaseRequest {
  @ApiProperty({ description: "User identifier, e.g. an email or username" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identifier!: string;
}
