import { useEffect, useState } from "react";

export interface Countdown {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function diffToCountdown(targetMs: number): Countdown {
  const totalSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  return {
    days: pad(Math.floor(totalSec / 86400)),
    hours: pad(Math.floor((totalSec % 86400) / 3600)),
    minutes: pad(Math.floor((totalSec % 3600) / 60)),
    seconds: pad(totalSec % 60),
  };
}

export function useCountdown(targetIso: string | undefined): Countdown {
  const targetMs = targetIso ? new Date(targetIso).getTime() : 0;
  const [countdown, setCountdown] = useState<Countdown>(() => diffToCountdown(targetMs));

  useEffect(() => {
    if (!targetIso) return;
    const tick = () => setCountdown(diffToCountdown(targetMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso, targetMs]);

  return countdown;
}
