import { awaitToError } from "../../lib/await-to-error";
import type { ErrorResponse } from "../../types/error";
import type { PurchaseResult, SaleStatus, UserStatus } from "../../types/flash-sale";
import { flashSale } from "./flash-sale-client";

export async function getFlashSaleStatus(saleId: string): Promise<SaleStatus> {
  const [err, status] = await awaitToError<ErrorResponse, SaleStatus>(flashSale.get<SaleStatus>(`/flash-sale/${saleId}/status`));
  if (err) throw err;

  return status;
}

export async function attemptPurchase(saleId: string, identifier: string): Promise<PurchaseResult> {
  const [err, result] = await awaitToError<ErrorResponse, PurchaseResult>(flashSale.post<PurchaseResult>(`/flash-sale/${saleId}/purchase`, { identifier }));
  if (err) throw err;

  return result;
}

export async function getUserStatus(saleId: string, identifier: string): Promise<UserStatus> {
  const [err, status] = await awaitToError<ErrorResponse, UserStatus>(flashSale.get<UserStatus>(`/flash-sale/${saleId}/purchase/${identifier}`));
  if (err) throw err;

  return status;
}
