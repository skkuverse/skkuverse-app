/**
 * The KST minute and day come from the epoch, so they hold on a phone in any
 * zone, either side of KST midnight and before 1970.
 */
import { describe, expect, it } from 'vitest';
import { KST_OFFSET_MS, kstDate, kstMinutesOfDay, toMinutesOfDay } from '../kst.rules';

// 2026-10-19T00:00:00+09:00, written as UTC.
const KST_MIDNIGHT = Date.UTC(2026, 9, 18, 15, 0, 0);

describe('KST_OFFSET_MS', () => {
  it('is nine hours', () => {
    // Assert
    expect(KST_OFFSET_MS).toBe(9 * 60 * 60 * 1000);
  });
});

describe('kstMinutesOfDay', () => {
  it.each([
    ['KST midnight', KST_MIDNIGHT, 0],
    ['08:05 KST', KST_MIDNIGHT + (8 * 60 + 5) * 60_000, 485],
    ['23:59 KST', KST_MIDNIGHT - 60_000, 1439],
    ['the epoch, 09:00 KST', 0, 540],
    ['one minute before the epoch, 08:59 KST', -60_000, 539],
  ])('%s', (_name, now, expected) => {
    // Act
    const minutes = kstMinutesOfDay(now);

    // Assert
    expect(minutes).toBe(expected);
  });
});

describe('kstDate', () => {
  it.each([
    ['00:00 KST is the new day', KST_MIDNIGHT, '2026-10-19'],
    ['23:59 KST is still the old day', KST_MIDNIGHT - 60_000, '2026-10-18'],
    ['00:30 KST, while UTC is still on the 18th', KST_MIDNIGHT + 30 * 60_000, '2026-10-19'],
    ['a negative now, 08:59 KST on 1970-01-01', -60_000, '1970-01-01'],
    ['a negative now before KST midnight, 1969-12-31', -(9 * 60 + 1) * 60_000, '1969-12-31'],
  ])('%s', (_name, now, expected) => {
    // Act
    const date = kstDate(now);

    // Assert
    expect(date).toBe(expected);
  });
});

describe('toMinutesOfDay — one spelling of an hour', () => {
  it('accepts a zero-padded 24-hour time', () => {
    expect(toMinutesOfDay('00:00')).toBe(0);
    expect(toMinutesOfDay('09:05')).toBe(545);
    expect(toMinutesOfDay('23:59')).toBe(1439);
  });

  it('rejects everything else, including the second spelling of midnight', () => {
    // "24:00" is the one worth naming: it is a real ISO-8601 time and it would
    // give midnight a second spelling. The server rejects it too.
    for (const bad of ['24:00', '7:00', '25:00', '12:60', '1200', '12:0', '', 'noon']) {
      expect(toMinutesOfDay(bad)).toBeNull();
    }
  });
});
