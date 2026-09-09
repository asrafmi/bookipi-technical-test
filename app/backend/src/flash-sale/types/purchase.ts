export const PurchaseErrorCode = {
  SALE_NOT_STARTED: "SALE_NOT_STARTED",
  SALE_ENDED: "SALE_ENDED",
  ALREADY_PURCHASED: "ALREADY_PURCHASED",
  SOLD_OUT: "SOLD_OUT",
  TEMPORARY_FAILURE: "TEMPORARY_FAILURE",
} as const;

export type PurchaseErrorCode = (typeof PurchaseErrorCode)[keyof typeof PurchaseErrorCode];


export const LuaOutcome = {
  OK: "OK",
  SALE_NOT_STARTED: "SALE_NOT_STARTED",
  SALE_ENDED: "SALE_ENDED",
  SOLD_OUT: "SOLD_OUT",
  ALREADY_PURCHASED: "ALREADY_PURCHASED",
} as const;

export type LuaOutcome = (typeof LuaOutcome)[keyof typeof LuaOutcome];

export type PurchaseGatewayResult =
  | { accepted: true }
  | { accepted: false; code: (typeof PurchaseErrorCode)[keyof typeof PurchaseErrorCode] };