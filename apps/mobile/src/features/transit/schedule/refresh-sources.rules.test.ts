/**
 * Which query a schedule service's refresh targets poll.
 */

import { describe, expect, it } from 'vitest';
import { refreshIntervals } from './refresh-sources.rules';

describe('refreshIntervals', () => {
  it('polls nothing for a service without refresh', () => {
    expect(refreshIntervals(undefined)).toStrictEqual({ smartSchedule: false });
  });

  it('polls the smart schedule for live estimates, at the served interval', () => {
    expect(refreshIntervals({ targets: ['traffic'], intervalSec: 60 })).toStrictEqual({
      smartSchedule: 60_000,
    });
  });

  it('polls the smart schedule for crowding too, once for both targets', () => {
    expect(refreshIntervals({ targets: ['crowding'], intervalSec: 30 })).toStrictEqual({
      smartSchedule: 30_000,
    });
    expect(refreshIntervals({ targets: ['traffic', 'crowding'], intervalSec: 90 })).toStrictEqual({
      smartSchedule: 90_000,
    });
  });
});
