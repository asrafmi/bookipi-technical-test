import { useCountdown } from "../hooks/use-countdown";

interface CountdownTimerProps {
  startLabel: string;
  targetIso: string;
}

export function CountdownTimer({ startLabel, targetIso }: Readonly<CountdownTimerProps>) {
  const { days, hours, minutes, seconds } = useCountdown(targetIso);

  return (
    <div className="countdown">
      <div className="countdown__label">{startLabel}</div>
      <div className="countdown__grid">
        <CountdownUnit value={days} unit="DAYS" />
        <CountdownUnit value={hours} unit="HRS" />
        <CountdownUnit value={minutes} unit="MIN" />
        <CountdownUnit value={seconds} unit="SEC" />
      </div>
    </div>
  );
}

function CountdownUnit({ value, unit }: Readonly<{ value: string; unit: string }>) {
  return (
    <div className="countdown__unit">
      <div className="countdown__value">{value}</div>
      <div className="countdown__unit-label">{unit}</div>
    </div>
  );
}
