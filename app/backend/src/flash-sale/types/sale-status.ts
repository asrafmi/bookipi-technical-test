export const SaleWindowStatus = {
  UPCOMING: "upcoming",
  ACTIVE: "active",
  ENDED: "ended",
} as const;

export type SaleWindowStatus = (typeof SaleWindowStatus)[keyof typeof SaleWindowStatus];

export const DEFAULT_SALE_ID = "default";
