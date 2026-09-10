import { useCallback, useEffect, useState } from "react";
import { attemptPurchase, getFlashSaleStatus } from "../api/flash-sale/flash-sale";
import { SubmitState, type PurchaseFailure, type PurchaseResult, type SaleStatus } from "../types/flash-sale";
import { config } from "../lib/config";
import awaitToError from "../lib/await-to-error";
import type { ErrorResponse } from "../types/error";

interface FlashSaleState {
  saleStatus: SaleStatus | null;
  identifier: string;
  submitState: SubmitState;
  failure: PurchaseFailure | null;
  successIdentifier: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidIdentifier(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function useFlashSale() {
  const { flashSale } = config;
  const [state, setState] = useState<FlashSaleState>({
    saleStatus: null,
    identifier: "",
    submitState: SubmitState.IDLE,
    failure: null,
    successIdentifier: null,
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
    setState((prev) => ({ ...prev, identifier, failure: null }));
  }, []);

  const submitPurchase = useCallback(async () => {
    setState((prev) => ({ ...prev, submitState: SubmitState.SUBMITTING, failure: null }));

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

  return {
    saleStatus: state.saleStatus,
    identifier: state.identifier,
    setIdentifier,
    submitState: state.submitState,
    failure: state.failure,
    successIdentifier: state.successIdentifier,
    submitPurchase,
  };
}
