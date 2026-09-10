export type FeedbackTone = "validation" | "success" | "neutral" | "error";

interface FeedbackMessageProps {
  tone: FeedbackTone;
  title: string;
  body: string;
}

export function FeedbackMessage({ tone, title, body }: Readonly<FeedbackMessageProps>) {
  return (
    <div className={`feedback feedback--${tone}`}>
      <span className="feedback__icon">{tone === "success" ? <CheckIcon /> : null}</span>
      <span className="feedback__text">
        <strong>{title}</strong>
        <br />
        {body}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10.5L8 14.5L16 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
