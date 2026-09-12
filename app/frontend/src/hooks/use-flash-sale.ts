import { useCallback, useEffect, useState } from "react";
import { attemptPurchase, getFlashSaleStatus, getUserStatus } from "../api/flash-sale/flash-sale";
import { SubmitState, type PurchaseFailure, type PurchaseResult, type SaleStatus, type UserStatus } from "../types/flash-sale";
import { config } from "../lib/config";
import awaitToError from "../lib/await-to-error";
import type { ErrorResponse } from "../types/error";
import { derivePurchaseCardView } from "../domains/flash-sale";

export { isValidIdentifier } from "../domains/flash-sale";

interface FlashSaleState {
  saleStatus: SaleStatus | null;
  identifier: string;
  submitState: SubmitState;
  failure: PurchaseFailure | null;
  successIdentifier: string | null;
  checkState: SubmitState;
  checkResult: UserStatus | null;
}

export function useFlashSale() {
  const { flashSale } = config;
  const [state, setState] = useState<FlashSaleState>({
    saleStatus: null,
    identifier: "",
    submitState: SubmitState.IDLE,
    failure: null,
    successIdentifier: null,
    checkState: SubmitState.IDLE,
    checkResult: null,
  });

  const refreshStatus = useCallback(async () => {
    const saleStatus = await getFlashSaleStatus(flashSale.defaultSaleId);
    setState((prev) => ({ ...prev, saleStatus }));
  }, [flashSale.defaultSaleId]);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const setIdentifier = useCallback((identifier: string) => {
    setState((prev) => ({ ...prev, identifier, failure: null, checkState: SubmitState.IDLE, checkResult: null }));
  }, []);

  const submitPurchase = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      submitState: SubmitState.SUBMITTING,
      failure: null,
      checkState: SubmitState.IDLE,
      checkResult: null,
    }));

    const trimmed = state.identifier.trim();
    const [err, result] = await awaitToError<ErrorResponse, PurchaseResult>(attemptPurchase(flashSale.defaultSaleId, trimmed));
    if (err) {
      setState((prev) => ({ ...prev, submitState: SubmitState.FAILURE, failure: { accepted: false, code: err.code, message: err.message } }));
      return;
    }
    if (!result.accepted) {
      setState((prev) => ({ ...prev, submitState: SubmitState.FAILURE, failure: result }));
      return;
    }
    setState((prev) => ({
      ...prev,
      submitState: SubmitState.SUCCESS,
      successIdentifier: result.identifier,
      saleStatus: prev.saleStatus
        ? { ...prev.saleStatus, stockRemaining: Math.max(0, prev.saleStatus.stockRemaining - 1) }
        : prev.saleStatus,
    }));

  }, [state.identifier, flashSale.defaultSaleId]);

  const checkStatus = useCallback(async () => {
    const trimmed = state.identifier.trim();
    setState((prev) => ({ ...prev, checkState: SubmitState.SUBMITTING, checkResult: null }));

    const [err, result] = await awaitToError<ErrorResponse, UserStatus>(getUserStatus(flashSale.defaultSaleId, trimmed));
    if (err) {
      setState((prev) => ({
        ...prev,
        checkState: SubmitState.FAILURE,
        checkResult: { accepted: false, code: err.code, message: err.message },
      }));
      return;
    }
    setState((prev) => ({ ...prev, checkState: SubmitState.SUCCESS, checkResult: result }));
  }, [state.identifier, flashSale.defaultSaleId]);

  const view = state.saleStatus
    ? derivePurchaseCardView({
        saleStatus: state.saleStatus,
        identifier: state.identifier,
        submitState: state.submitState,
        failure: state.failure,
        successIdentifier: state.successIdentifier,
      })
    : null;

  return {
    saleStatus: state.saleStatus,
    identifier: state.identifier,
    setIdentifier,
    submitState: state.submitState,
    failure: state.failure,
    successIdentifier: state.successIdentifier,
    submitPurchase,
    checkState: state.checkState,
    checkResult: state.checkResult,
    checkStatus,
    view,
  };
}
