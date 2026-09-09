import { SaleWindowStatus } from "../../types/sale-status";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";

export interface SaleStatus {
  status: SaleWindowStatus;
  productName: string;
  productDescription: string;
  startsAt: string;
  endsAt: string;
  stockRemaining: number;
  totalStock: number;
}

export type PurchaseResult =
  | { accepted: true; identifier: string; purchasedAt: string }
  | { accepted: false; code: PurchaseErrorCode; message: string };
