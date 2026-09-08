export type BadgeTone = "upcoming" | "live" | "ended";

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" />
      {label}
    </span>
  );
}
