import { useMemo } from "react";
import { CountdownTimer } from "./CountdownTimer";
import { FeedbackMessage } from "./FeedbackMessage";
import { StatusBadge, type BadgeTone } from "./StatusBadge";
import { isValidIdentifier, useFlashSale } from "../hooks/useFlashSale";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function PurchaseCard() {
  const { saleStatus, identifier, setIdentifier, submitState, failure, successIdentifier, submitPurchase } =
    useFlashSale();

  const trimmedIdentifier = identifier.trim();
  const identifierTouched = trimmedIdentifier.length > 0;
  const identifierIsValid = isValidIdentifier(trimmedIdentifier);
  const isSubmitting = submitState === "submitting";

  const hasSucceeded = submitState === "success";
  const isAlreadyPurchased = failure?.code === "ALREADY_PURCHASED";
  const isSoldOut = saleStatus?.status === "active" && saleStatus.stockRemaining <= 0 && !hasSucceeded;
  const isEnded = saleStatus?.status === "ended";
  const isUpcoming = saleStatus?.status === "upcoming";
  const isLocked = hasSucceeded || isAlreadyPurchased || isSoldOut || isEnded;

  const badge = useMemo((): { label: string; tone: BadgeTone } => {
    if (isUpcoming) return { label: "Upcoming", tone: "upcoming" };
    if (isEnded) return { label: "Ended", tone: "ended" };
    return { label: "Live", tone: "live" };
  }, [isUpcoming, isEnded]);

  if (!saleStatus) {
    return (
      <div className="card">
        <p className="card__loading">Loading sale status…</p>
      </div>
    );
  }

  const stockText = isEnded
    ? `Final tally: ${saleStatus.totalStock - saleStatus.stockRemaining} sold`
    : isUpcoming
      ? `${saleStatus.totalStock} units at launch`
      : `${saleStatus.stockRemaining} units left`;

  const inputDisabled = isUpcoming || isLocked || isSubmitting;

  const buttonLabel = (() => {
    if (isUpcoming) return "Buy Now";
    if (hasSucceeded) return "Purchased";
    if (isAlreadyPurchased) return "Already Purchased";
    if (isSoldOut) return "Sold Out";
    if (isEnded) return "Sale Ended";
    if (failure?.code === "NETWORK_ERROR") return "Try Again";
    return "Buy Now";
  })();

  const buttonDisabled =
    isUpcoming ||
    isLocked ||
    isSubmitting ||
    !identifierTouched ||
    !identifierIsValid;

  const showValidationFeedback = identifierTouched && !identifierIsValid && !isLocked && !isSubmitting;
  const showAnyFeedback =
    showValidationFeedback || (hasSucceeded && successIdentifier) || isAlreadyPurchased || isSoldOut || isEnded || failure;

  return (
    <div className="card">
      <div className="card__media">
        <img className="card__image" src={saleStatus.productImage} alt={saleStatus.productName} />
      </div>

      <div className="card__content">
        <StatusBadge label={badge.label} tone={badge.tone} />

        {isUpcoming && (
          <CountdownTimer
            startLabel={`Starts ${new Date(saleStatus.startsAt).toLocaleString("en-US", DATE_FORMAT)}`}
            targetIso={saleStatus.startsAt}
          />
        )}

        <div className="card__product">
          <h3>{saleStatus.productName}</h3>
          <p>{saleStatus.productDescription}</p>
        </div>

        <div className="card__stock">
          <span>Remaining</span>
          <span>{stockText}</span>
        </div>

        <div className="card__field">
          <label htmlFor="identifier">Email or username</label>
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or username"
            disabled={inputDisabled}
            className={showValidationFeedback ? "input--invalid" : ""}
          />
        </div>

        {showAnyFeedback && (
          <div className="card__feedback-slot">
            {showValidationFeedback && (
              <FeedbackMessage
                tone="validation"
                title="Check your entry"
                body="Enter a valid email address or username to continue."
              />
            )}
            {hasSucceeded && successIdentifier && (
              <FeedbackMessage tone="success" title="You're in." body={`Confirmed for ${successIdentifier}.`} />
            )}
            {isAlreadyPurchased && failure && (
              <FeedbackMessage tone="neutral" title="You're already in" body={failure.message} />
            )}
            {isSoldOut && !failure && (
              <FeedbackMessage tone="neutral" title="Every unit is claimed" body="Thanks for trying." />
            )}
            {isEnded && (
              <FeedbackMessage tone="neutral" title="This drop has closed" body="Follow for the next release date." />
            )}
            {failure && failure.code !== "ALREADY_PURCHASED" && !isSoldOut && !isEnded && (
              <FeedbackMessage tone="error" title="Something went wrong" body={failure.message} />
            )}
          </div>
        )}

        <button
          disabled={buttonDisabled}
          onClick={submitPurchase}
          className={`buy-button ${hasSucceeded ? "buy-button--success" : ""}`}
        >
          {isSubmitting ? (
            <span className="dots">
              <span className="dots__dot" />
              <span className="dots__dot" />
              <span className="dots__dot" />
            </span>
          ) : (
            buttonLabel
          )}
        </button>

        <div className="card__secondary">
          <a href="#" onClick={(e) => e.preventDefault()}>
            Already have one? Check your status
          </a>
        </div>
      </div>
    </div>
  );
}
