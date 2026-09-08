export type SaleWindowStatus = "upcoming" | "active" | "ended";

export interface SaleStatus {
  status: SaleWindowStatus;
  productName: string;
  productDescription: string;
  productImage: string;
  startsAt: string;
  endsAt: string;
  stockRemaining: number;
  totalStock: number;
}

export type PurchaseErrorCode =
  | "SALE_NOT_STARTED"
  | "SALE_ENDED"
  | "ALREADY_PURCHASED"
  | "SOLD_OUT"
  | "INVALID_IDENTIFIER"
  | "NETWORK_ERROR";

export interface PurchaseSuccess {
  ok: true;
  identifier: string;
  purchasedAt: string;
}

export interface PurchaseFailure {
  ok: false;
  code: PurchaseErrorCode;
  message: string;
}

export type PurchaseResult = PurchaseSuccess | PurchaseFailure;

export interface UserStatus {
  hasPurchased: boolean;
  identifier: string;
  purchasedAt?: string;
}
