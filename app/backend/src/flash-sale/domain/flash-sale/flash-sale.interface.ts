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
  | { ok: true; identifier: string; purchasedAt: string }
  | { ok: false; code: PurchaseErrorCode; message: string };
