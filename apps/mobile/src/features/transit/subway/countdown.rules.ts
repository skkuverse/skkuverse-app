import { kstMinutesOfDay } from '@skkuverse/shared';

// EVIDENCE: the estimate is off by 15-60 s (skkuverse-server/docs/reference/subway-api.md), so minutes are
// rounded down and never seconds; under a minute reads as arriving.
export type Countdown = { kind: 'arriving' } | { kind: 'in'; minutes: number } | { kind: 'at'; time: string };

// WHY: a deliberate product decision, not a tuning value: an arrival an hour or more away reads as a clock time.
// SEE: docs/decisions/0022-places-open-on-the-map-intents-start-in-transit.md ("4. A stop is one pole, and its sheet renders entries by kind")
export const CLOCK_TIME_FROM_MINUTES = 60;

// WHY: the KST clock time comes from the epoch, never `Date.getHours()`, so a phone in another zone reads the same.
export function countdown(arrivalAt: number, now: number): Countdown {
  const minutes = Math.floor((arrivalAt - now) / 60_000);
  if (minutes >= CLOCK_TIME_FROM_MINUTES) return { kind: 'at', time: clockTimeOf(arrivalAt) };
  return minutes < 1 ? { kind: 'arriving' } : { kind: 'in', minutes };
}

export type FirstTrainMark = 'label' | 'badge';

export interface TrainTime {
  countdown: Countdown;
  firstTrain: FirstTrainMark | null;
}

// WHY: a first train under an hour away keeps the minutes plus a badge, so "nothing runs before it", learned at 60 minutes, does not vanish.
export function trainTime(train: { arrivalAt: number; isFirstRun: boolean }, now: number): TrainTime {
  const c = countdown(train.arrivalAt, now);
  if (!train.isFirstRun) return { countdown: c, firstTrain: null };
  return { countdown: c, firstTrain: c.kind === 'at' ? 'label' : 'badge' };
}

function clockTimeOf(epochMs: number): string {
  const minutes = kstMinutesOfDay(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function trackPosition(arrivalAt: number, now: number, windowMs: number): number {
  const left = arrivalAt - now;
  return Math.min(1, Math.max(0, 1 - left / windowMs));
}
