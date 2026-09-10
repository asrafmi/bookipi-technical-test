import { awaitToError } from "../../lib/await-to-error";
import type { PurchaseResult, SaleStatus, UserStatus } from "../../types/flash-sale";
import { flashSale } from "./flash-sale-client";

export async function getFlashSaleStatus(saleId: string): Promise<SaleStatus> {
  const [err, status] = await awaitToError(flashSale.get<SaleStatus>(`/flash-sale/${saleId}/status`));
  if (err) throw new Error("Failed to fetch sale status");

  return status;
}

export async function attemptPurchase(saleId: string, identifier: string): Promise<PurchaseResult> {
  const [err, result] = await awaitToError(flashSale.post<PurchaseResult>(`/flash-sale/${saleId}/purchase`, { identifier }));
  if (err) throw new Error("Failed to attempt purchase");

  return result;
}

export async function getUserStatus(saleId: string, identifier: string): Promise<UserStatus> {
  const [err, status] = await awaitToError(flashSale.get<UserStatus>(`/flash-sale/${saleId}/purchase/${identifier}`));
  if (err) throw new Error("Failed to fetch user status");

  return status;
}
