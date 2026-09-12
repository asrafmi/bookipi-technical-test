export const SaleWindowStatus = {
  UPCOMING: "upcoming",
  ACTIVE: "active",
  ENDED: "ended",
} as const;
export type SaleWindowStatus = (typeof SaleWindowStatus)[keyof typeof SaleWindowStatus];

export interface SaleStatus {
  status: SaleWindowStatus;
  productName: string;
  productDescription: string;
  productImage?: string;
  startsAt: string;
  endsAt: string;
  stockRemaining: number;
  totalStock: number;
}

export const SubmitState = {
  IDLE: "idle",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  FAILURE: "failure",
} as const;
export type SubmitState = typeof SubmitState[keyof typeof SubmitState];


export const PurchaseErrorCode = {
  SALE_NOT_STARTED: "SALE_NOT_STARTED",
  SALE_ENDED: "SALE_ENDED",
  ALREADY_PURCHASED: "ALREADY_PURCHASED",
  SOLD_OUT: "SOLD_OUT",
  NOT_PURCHASED: "NOT_PURCHASED",
  TEMPORARY_FAILURE: "TEMPORARY_FAILURE",
  INVALID_IDENTIFIER: "INVALID_IDENTIFIER",
  NETWORK_ERROR: "NETWORK_ERROR"
} as const;
export type PurchaseErrorCode = (typeof PurchaseErrorCode)[keyof typeof PurchaseErrorCode];

export interface PurchaseSuccess {
  accepted: true;
  identifier: string;
  purchasedAt: string;
}

export interface PurchaseFailure {
  accepted: false;
  code: PurchaseErrorCode;
  message: string;
}

export type PurchaseResult = PurchaseSuccess | PurchaseFailure;

// `GET .../purchase/:identifier` returns the same discriminated-union shape as
// `POST .../purchase` (see backend AttemptPurchaseResponse) — checking status is
// just a read of the same result a purchase attempt would have produced.
export type UserStatus = PurchaseResult;
