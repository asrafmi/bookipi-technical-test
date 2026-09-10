import type { PurchaseErrorCode } from "./flash-sale";

export interface ErrorResponse {
  code: PurchaseErrorCode;
  name: string;
  status: number;
  message: string;
  stack: string;
}