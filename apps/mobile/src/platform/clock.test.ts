/**
 * The device clock (spec platform/device-clock), driven through the two parts
 * `useClock` wires together: the timer it arms for the next edge and the
 * AppState listener. Fake timers stand in for time, and a fake AppState for the
 * operating system.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toAlignedEdge } from '@skkuverse/shared';
import { armClock, subscribeForeground, toClockState } from './clock';

const appState = vi.hoisted(() => {
  const listeners = new Set<(state: string) => void>();
  return {
    listeners,
    emit: (state: string) => listeners.forEach((listener) => listener(state)),
  };
});

vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  AppState: {
    addEventListener: (_type: 'change', listener: (state: string) => void) => {
      appState.listeners.add(listener);
      return { remove: () => appState.listeners.delete(listener) };
    },
  },
}));

const START = 1_700_000_012_345;
const DAY_MS = 86_400_000;

/** What the hook does: each tick becomes the new `now`, and the timer re-arms from it. */
function runClock(start: number, nextEdge: (now: number) => number | null): number[] {
  const ticks: number[] = [];
  const arm = (now: number) => {
    armClock(now, nextEdge, (next) => {
      ticks.push(next);
      arm(next);
    });
  };
  arm(start);
  return ticks;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  appState.listeners.clear();
});

describe('armClock', () => {
  it('moves a 30-second clock on its 30-second boundaries, not 30 seconds after it started', () => {
    // Arrange
    const ticks = runClock(START, (now) => toAlignedEdge(now, 30_000));

    // Act
    vi.advanceTimersByTime(90_000);

    // Assert
    expect(ticks).toEqual([1_700_000_040_000, 1_700_000_070_000, 1_700_000_100_000]);
  });

  it('arms no timer when there is no next edge', () => {
    // Arrange
    const onTick = vi.fn();

    // Act
    armClock(START, () => null, onTick);

    // Assert
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(DAY_MS);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('waits out an edge 40 days away in capped steps, firing only at the edge', () => {
    // Arrange
    const edge = START + 40 * DAY_MS;
    const onTick = vi.fn();
    armClock(START, () => edge, onTick);

    // Act
    vi.advanceTimersByTime(30 * DAY_MS);

    // Assert
    expect(onTick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(10 * DAY_MS);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledWith(edge);
  });

  it('fires at once for an edge already past', () => {
    // Arrange
    const onTick = vi.fn();
    armClock(START, () => START - 1_000, onTick);

    // Act
    vi.advanceTimersByTime(0);

    // Assert
    expect(onTick).toHaveBeenCalledWith(START);
  });

  it('catches a stale now up to the wall clock at once, before the next edge', () => {
    // Arrange
    const onTick = vi.fn();
    armClock(START - 5_000, () => START + DAY_MS, onTick);

    // Act
    vi.advanceTimersByTime(0);

    // Assert
    expect(onTick).toHaveBeenCalledWith(START);
  });

  it('cancels its timer', () => {
    // Arrange
    const onTick = vi.fn();
    const cancel = armClock(START, () => START + 1_000, onTick);

    // Act
    cancel();

    // Assert
    vi.advanceTimersByTime(2_000);
    expect(onTick).not.toHaveBeenCalled();
  });
});

describe('toClockState', () => {
  const MINUTE_MS = 60_000;

  it('keeps the stored now while nextEdge is the same function', () => {
    // Arrange
    const nextEdge = () => null;
    const clock = { now: START, nextEdge };
    vi.advanceTimersByTime(20 * MINUTE_MS);

    // Act
    const next = toClockState(clock, nextEdge, Date.now);

    // Assert
    expect(next).toBe(clock);
  });

  it('reads the wall clock again when nextEdge changes, so a new edge is never judged at a stale now', () => {
    // Arrange
    const clock = { now: START, nextEdge: () => null };
    vi.advanceTimersByTime(20 * MINUTE_MS);
    const nextEdge = (now: number) => now + MINUTE_MS;

    // Act
    const next = toClockState(clock, nextEdge, Date.now);

    // Assert
    expect(next).toEqual({ now: START + 20 * MINUTE_MS, nextEdge });
  });
});

describe('subscribeForeground', () => {
  it('calls back on a return to the foreground, and on nothing else', () => {
    // Arrange
    const onActive = vi.fn();
    subscribeForeground(onActive);

    // Act
    appState.emit('background');
    appState.emit('inactive');
    appState.emit('active');

    // Assert
    expect(onActive).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unsubscribed', () => {
    // Arrange
    const onActive = vi.fn();
    const unsubscribe = subscribeForeground(onActive);

    // Act
    unsubscribe();
    appState.emit('active');

    // Assert
    expect(onActive).not.toHaveBeenCalled();
  });
});
