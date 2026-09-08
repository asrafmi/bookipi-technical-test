import { useCallback, useEffect, useState } from "react";
import { attemptPurchase, fetchSaleStatus } from "../api/flashSaleApi";
import { SubmitState, type PurchaseFailure, type SaleStatus } from "../types/flashSale";

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
  const [state, setState] = useState<FlashSaleState>({
    saleStatus: null,
    identifier: "",
    submitState: SubmitState.IDLE,
    failure: null,
    successIdentifier: null,
  });

  const refreshStatus = useCallback(async () => {
    const saleStatus = await fetchSaleStatus();
    setState((prev) => ({ ...prev, saleStatus }));
  }, []);

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
    const result = await attemptPurchase(trimmed);

    if (result.ok) {
      setState((prev) => ({
        ...prev,
        submitState: SubmitState.SUCCESS,
        successIdentifier: result.identifier,
        saleStatus: prev.saleStatus
          ? { ...prev.saleStatus, stockRemaining: Math.max(0, prev.saleStatus.stockRemaining - 1) }
          : prev.saleStatus,
      }));
    } else {
      setState((prev) => ({ ...prev, submitState: SubmitState.FAILURE, failure: result }));
    }
  }, [state.identifier]);

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
