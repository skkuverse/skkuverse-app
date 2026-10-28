import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toAlignedEdge, toArmDelay } from '@skkuverse/shared';

const STALE_AFTER_MS = 1000;

export function armClock(
  now: number,
  nextEdge: (now: number) => number | null,
  onTick: (now: number) => void,
): () => void {
  const wall = Date.now();
  // WHY: the stored now is only stale when nextEdge changed, and an edge the new
  // function names between it and the wall clock would otherwise be skipped.
  const edge = wall - now > STALE_AFTER_MS ? wall : nextEdge(now);
  if (edge === null) return () => {};
  let timer: ReturnType<typeof setTimeout>;
  const arm = (from: number) => {
    timer = setTimeout(() => {
      const at = Date.now();
      if (at < edge) arm(at);
      else onTick(at);
    }, toArmDelay(edge, from));
  };
  arm(wall);
  return () => clearTimeout(timer);
}

export function subscribeForeground(onActive: () => void): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onActive();
  });
  return () => subscription.remove();
}

/** WHY: for a handler or an effect only; a render reads `useClock` or `useNow`, or it freezes. */
export function readNow(): number {
  return Date.now();
}

type NextEdge = (now: number) => number | null;

export interface ClockState {
  now: number;
  nextEdge: NextEdge;
}

export function toClockState(clock: ClockState, nextEdge: NextEdge, readWall: () => number): ClockState {
  return clock.nextEdge === nextEdge ? clock : { now: readWall(), nextEdge };
}

/** WHY: pass a stable `nextEdge` (`useCallback`); a new function re-reads the wall time. */
export function useClock(nextEdge: NextEdge): number {
  // WHY: a render that reads `Date.now()` is memoized by the React Compiler on its
  // other inputs and freezes, so time has to be an input held in state.
  const [clock, setClock] = useState<ClockState>(() => ({ now: Date.now(), nextEdge }));
  // WHY: a new nextEdge (a refetched sentAt) is judged at the wall time in the same render, not at
  // the stored now, which may be minutes old and would show a stale state for one commit.
  const current = toClockState(clock, nextEdge, Date.now);
  if (current !== clock) setClock(current);
  const { now } = current;
  useEffect(() => armClock(now, nextEdge, (at) => setClock({ now: at, nextEdge })), [now, nextEdge]);
  // WHY: the OS delays or drops timers in the background, so the first frame back
  // would show the time the app left with.
  useEffect(
    () => subscribeForeground(() => setClock((prev) => ({ now: Date.now(), nextEdge: prev.nextEdge }))),
    [],
  );
  return now;
}

export function useNow(everyMs: number): number {
  const nextEdge = useCallback((now: number) => toAlignedEdge(now, everyMs), [everyMs]);
  return useClock(nextEdge);
}
