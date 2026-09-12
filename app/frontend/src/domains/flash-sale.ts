import type { BadgeTone } from "../components/StatusBadge";
import type { FeedbackTone } from "../components/FeedbackMessage";
import { PurchaseErrorCode, type PurchaseFailure, type SaleStatus, type SubmitState, type UserStatus } from "../types/flash-sale";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidIdentifier(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

const SALE_START_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function formatSaleStartLabel(startsAtIso: string): string {
  return `Starts ${new Date(startsAtIso).toLocaleString("en-US", SALE_START_DATE_FORMAT)}`;
}

export interface PurchaseCardViewState {
  isSubmitting: boolean;
  hasSucceeded: boolean;
  isAlreadyPurchased: boolean;
  isSoldOut: boolean;
  isEnded: boolean;
  isUpcoming: boolean;
  isLocked: boolean;
  identifierTouched: boolean;
  identifierIsValid: boolean;
  badge: { label: string; tone: BadgeTone };
  stockText: string;
  inputDisabled: boolean;
  buttonLabel: string;
  buttonDisabled: boolean;
  showValidationFeedback: boolean;
  showAnyFeedback: boolean;
  checkStatusDisabled: boolean;
}

export function deriveCheckResultFeedback(
  checkResult: UserStatus | null,
): { title: string; body: string; tone: FeedbackTone } | null {
  if (!checkResult) return null;
  if (checkResult.accepted) {
    return { tone: "success", title: "You're in.", body: `Confirmed for ${checkResult.identifier}.` };
  }
  if (checkResult.code === PurchaseErrorCode.NOT_PURCHASED) {
    return { tone: "neutral", title: "Not purchased yet", body: "This identifier hasn't secured an item." };
  }
  return { tone: "error", title: "Couldn't check status", body: checkResult.message };
}

export function deriveBadge(isUpcoming: boolean, isEnded: boolean): { label: string; tone: BadgeTone } {
  if (isUpcoming) return { label: "Upcoming", tone: "upcoming" };
  if (isEnded) return { label: "Ended", tone: "ended" };
  return { label: "Live", tone: "live" };
}

export function deriveStockText(saleStatus: SaleStatus, isEnded: boolean, isUpcoming: boolean): string {
  if (isEnded) return `Final tally: ${saleStatus.totalStock - saleStatus.stockRemaining} sold`;
  if (isUpcoming) return `${saleStatus.totalStock} units at launch`;
  return `${saleStatus.stockRemaining} units left`;
}

export function deriveButtonLabel(params: {
  isUpcoming: boolean;
  hasSucceeded: boolean;
  isAlreadyPurchased: boolean;
  isSoldOut: boolean;
  isEnded: boolean;
  failure: PurchaseFailure | null;
}): string {
  const { isUpcoming, hasSucceeded, isAlreadyPurchased, isSoldOut, isEnded, failure } = params;
  if (isUpcoming) return "Buy Now";
  if (hasSucceeded) return "Purchased";
  if (isAlreadyPurchased) return "Already Purchased";
  if (isSoldOut) return "Sold Out";
  if (isEnded) return "Sale Ended";
  if (failure?.code === "NETWORK_ERROR") return "Try Again";
  return "Buy Now";
}

export function derivePurchaseCardView(params: {
  saleStatus: SaleStatus;
  identifier: string;
  submitState: SubmitState;
  failure: PurchaseFailure | null;
  successIdentifier: string | null;
}): PurchaseCardViewState {
  const { saleStatus, identifier, submitState, failure, successIdentifier } = params;

  const trimmedIdentifier = identifier.trim();
  const identifierTouched = trimmedIdentifier.length > 0;
  const identifierIsValid = isValidIdentifier(trimmedIdentifier);
  const isSubmitting = submitState === "submitting";

  const hasSucceeded = submitState === "success";
  const isAlreadyPurchased = failure?.code === "ALREADY_PURCHASED";
  const isSoldOut = saleStatus.status === "active" && saleStatus.stockRemaining <= 0 && !hasSucceeded;
  const isEnded = saleStatus.status === "ended";
  const isUpcoming = saleStatus.status === "upcoming";
  const isLocked = hasSucceeded || isAlreadyPurchased || isSoldOut || isEnded;

  const badge = deriveBadge(isUpcoming, isEnded);
  const stockText = deriveStockText(saleStatus, isEnded, isUpcoming);
  const inputDisabled = isUpcoming || isLocked || isSubmitting;
  const buttonLabel = deriveButtonLabel({ isUpcoming, hasSucceeded, isAlreadyPurchased, isSoldOut, isEnded, failure });
  const buttonDisabled = isUpcoming || isLocked || isSubmitting || !identifierTouched || !identifierIsValid;

  const showValidationFeedback = identifierTouched && !identifierIsValid && !isLocked && !isSubmitting;
  const showAnyFeedback =
    showValidationFeedback ||
    (hasSucceeded && Boolean(successIdentifier)) ||
    isAlreadyPurchased ||
    isSoldOut ||
    isEnded ||
    Boolean(failure);

  // Checking status only needs a syntactically valid identifier typed in — it's a
  // read, not gated by the purchase window/lock the way "Buy Now" is.
  const checkStatusDisabled = isSubmitting || !identifierTouched || !identifierIsValid;

  return {
    isSubmitting,
    hasSucceeded,
    isAlreadyPurchased,
    isSoldOut,
    isEnded,
    isUpcoming,
    isLocked,
    identifierTouched,
    identifierIsValid,
    badge,
    stockText,
    inputDisabled,
    buttonLabel,
    buttonDisabled,
    showValidationFeedback,
    showAnyFeedback,
    checkStatusDisabled,
  };
}
