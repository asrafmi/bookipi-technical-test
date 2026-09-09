export const PurchaseErrorCode = {
  SALE_NOT_STARTED: "SALE_NOT_STARTED",
  SALE_ENDED: "SALE_ENDED",
  ALREADY_PURCHASED: "ALREADY_PURCHASED",
  SOLD_OUT: "SOLD_OUT",
  TEMPORARY_FAILURE: "TEMPORARY_FAILURE",
  NOT_PURCHASED: "NOT_PURCHASED",
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

export const PurchaseErrorHttpStatus: Record<PurchaseErrorCode, number> = {
  [PurchaseErrorCode.SALE_NOT_STARTED]: 403,
  [PurchaseErrorCode.SALE_ENDED]: 410,
  [PurchaseErrorCode.ALREADY_PURCHASED]: 409,
  [PurchaseErrorCode.SOLD_OUT]: 409,
  [PurchaseErrorCode.TEMPORARY_FAILURE]: 503,
  [PurchaseErrorCode.NOT_PURCHASED]: 200,
};