import { describe, it, expect } from 'vitest';
import { nextSnapshot, type ConditionalSnapshot } from '../conditional';

/** The shape the snapshot carries here; the real schedule type lives in the app's transit feature. */
type SmartSchedule = { status: string; selectedDate: string; days: unknown[] };

const schedule = (selectedDate: string): SmartSchedule =>
  ({ status: 'active', selectedDate, days: [] }) as unknown as SmartSchedule;

const PREVIOUS: ConditionalSnapshot<SmartSchedule> = { data: schedule('2026-10-16'), etag: 'W/"a"' };

describe('nextSnapshot', () => {
  it('keeps the cached snapshot itself on a 304', () => {
    const next = nextSnapshot(PREVIOUS, { data: null, etag: 'W/"a"', notModified: true });
    expect(next).toBe(PREVIOUS);
  });

  it('replaces the schedule and its ETag on a 200', () => {
    const fresh = schedule('2026-10-17');
    expect(nextSnapshot(PREVIOUS, { data: fresh, etag: 'W/"b"', notModified: false })).toEqual({
      data: fresh,
      etag: 'W/"b"',
    });
  });

  it('keeps a 200 served without an ETag, so the next request is unconditional', () => {
    const fresh = schedule('2026-10-17');
    expect(nextSnapshot(PREVIOUS, { data: fresh, etag: null, notModified: false })).toEqual({
      data: fresh,
      etag: null,
    });
  });

  it('caches the first response', () => {
    const first = schedule('2026-10-16');
    expect(nextSnapshot(undefined, { data: first, etag: 'W/"a"', notModified: false })).toEqual({
      data: first,
      etag: 'W/"a"',
    });
  });

  it('has nothing to keep for a 304 with no cached snapshot', () => {
    expect(nextSnapshot(undefined, { data: null, etag: null, notModified: true })).toBeUndefined();
  });
});
