export const PURCHASE_PERSISTENCE_QUEUE = "purchase-persistence";
export const PERSIST_PURCHASE_JOB = "persist-purchase";

export interface PersistPurchaseJobData {
  saleId: string;
  identifier: string;
}
