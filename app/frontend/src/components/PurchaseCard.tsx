import { CountdownTimer } from "./CountdownTimer";
import { FeedbackMessage } from "./FeedbackMessage";
import { StatusBadge } from "./StatusBadge";
import { useFlashSale } from "../hooks/use-flash-sale";
import { deriveCheckResultFeedback, formatSaleStartLabel } from "../domains/flash-sale";

export function PurchaseCard() {
  const {
    saleStatus,
    identifier,
    setIdentifier,
    failure,
    successIdentifier,
    submitPurchase,
    checkState,
    checkResult,
    checkStatus,
    view,
  } = useFlashSale();

  if (!saleStatus || !view) {
    return (
      <div className="card">
        <p className="card__loading">Loading sale status…</p>
      </div>
    );
  }

  const checkResultFeedback = deriveCheckResultFeedback(checkResult);

  return (
    <div className="card">
      <div className="card__media">
        <img className="card__image" src={saleStatus.productImage || "Lionel Messi Premium Kit.jpg"} alt={saleStatus.productName} />
      </div>

      <div className="card__content">
        <StatusBadge label={view.badge.label} tone={view.badge.tone} />

        {view.isUpcoming && (
          <CountdownTimer startLabel={formatSaleStartLabel(saleStatus.startsAt)} targetIso={saleStatus.startsAt} />
        )}

        <div className="card__product">
          <h3>{saleStatus.productName}</h3>
          <p>{saleStatus.productDescription}</p>
        </div>

        <div className="card__stock">
          <span>Remaining</span>
          <span>{view.stockText}</span>
        </div>

        <div className="card__field">
          <label htmlFor="identifier">Email or username</label>
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or username"
            disabled={view.inputDisabled}
            className={view.showValidationFeedback ? "input--invalid" : ""}
          />
        </div>

        {view.showAnyFeedback && (
          <div className="card__feedback-slot">
            {view.showValidationFeedback && (
              <FeedbackMessage
                tone="validation"
                title="Check your entry"
                body="Enter a valid email address or username to continue."
              />
            )}
            {view.hasSucceeded && successIdentifier && (
              <FeedbackMessage tone="success" title="You're in." body={`Confirmed for ${successIdentifier}.`} />
            )}
            {view.isAlreadyPurchased && failure && (
              <FeedbackMessage tone="neutral" title="You're already in" body={failure.message} />
            )}
            {view.isSoldOut && !failure && (
              <FeedbackMessage tone="neutral" title="Every unit is claimed" body="Thanks for trying." />
            )}
            {view.isEnded && (
              <FeedbackMessage tone="neutral" title="This drop has closed" body="Follow for the next release date." />
            )}
            {failure && failure.code !== "ALREADY_PURCHASED" && !view.isSoldOut && !view.isEnded && (
              <FeedbackMessage tone="error" title="Something went wrong" body={failure.message} />
            )}
          </div>
        )}

        {checkResultFeedback && (
          <div className="card__feedback-slot">
            <FeedbackMessage
              tone={checkResultFeedback.tone}
              title={checkResultFeedback.title}
              body={checkResultFeedback.body}
            />
          </div>
        )}

        <button
          disabled={view.buttonDisabled}
          onClick={submitPurchase}
          className={`buy-button ${view.hasSucceeded ? "buy-button--success" : ""}`}
        >
          {view.isSubmitting ? (
            <span className="dots">
              <span className="dots__dot" />
              <span className="dots__dot" />
              <span className="dots__dot" />
            </span>
          ) : (
            view.buttonLabel
          )}
        </button>

        <div className="card__secondary">
          <button type="button" className="link-button" disabled={view.checkStatusDisabled} onClick={checkStatus}>
            {checkState === "submitting" ? "Checking…" : "Already have one? Check your status"}
          </button>
        </div>
      </div>
    </div>
  );
}
