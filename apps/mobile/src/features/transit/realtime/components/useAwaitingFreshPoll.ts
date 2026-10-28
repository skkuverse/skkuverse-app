import { isAwaitingFreshPoll } from '../marker-geometry.rules';

export function useAwaitingFreshPoll(pollAtMs: number, resumedAtMs: number, nowMs: number): boolean {
  return isAwaitingFreshPoll({ pollAtMs, resumedAtMs, nowMs });
}
