import { useNow } from './useNow';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  done: boolean;
}

export function splitDuration(ms: number): Countdown {
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs: total,
    done: total <= 0,
  };
}

export function useCountdown(targetMs: number | null): Countdown {
  const now = useNow(targetMs !== null);
  return splitDuration(targetMs === null ? 0 : targetMs - now);
}
