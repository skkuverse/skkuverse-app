/**
 * The edge the campus clock waits for: the sooner of the next opening-hours
 * boundary and the next layer-window boundary. The clock built on it
 * (`useWindowEdgeClock` over `platform/clock`'s `useClock`) also moves on a
 * return to the foreground; that wiring is `useClock`'s, tested in
 * `platform/clock.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { nextWindowEdge } from './window-edge.rules';
import type { DailyWindow } from '../../map-config.types';
import type { OpeningWindow } from '../../overlay.types';

const KST = (iso: string) => Date.parse(`${iso}+09:00`);
const hours = (startAt: string, endAt: string | null): OpeningWindow => ({ startAt, endAt, label: null });
const BOOTH = [hours('2026-10-20T10:00:00+09:00', '2026-10-20T18:00:00+09:00')];
const PUB: DailyWindow[] = [{ start: '18:00', end: '00:00' }];

describe('nextWindowEdge', () => {
  it('waits for a booth opening when no layer window comes sooner', () => {
    // Act
    const edge = nextWindowEdge(BOOTH, [], KST('2026-10-20T09:00:00'));

    // Assert
    expect(edge).toBe(KST('2026-10-20T10:00:00'));
  });

  it('waits for a layer window when it comes before any opening-hours boundary', () => {
    // Act
    const edge = nextWindowEdge([], PUB, KST('2026-10-20T17:30:00'));

    // Assert
    expect(edge).toBe(KST('2026-10-20T18:00:00'));
  });

  it('takes the sooner of the two', () => {
    // Act
    const edge = nextWindowEdge(BOOTH, PUB, KST('2026-10-20T11:00:00'));

    // Assert
    expect(edge).toBe(KST('2026-10-20T18:00:00'));
  });

  it('has no edge when nothing is windowed', () => {
    // Act
    const edge = nextWindowEdge([], [], KST('2026-10-20T11:00:00'));

    // Assert
    expect(edge).toBeNull();
  });
});
