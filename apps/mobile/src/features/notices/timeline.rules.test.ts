/**
 * The detail screen's date timeline as it reads today on a phone in Seoul:
 * each period's range text, its past, current or future status, and the
 * nearest open deadline highlighted. Each case passes its own instant.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildNoticeTimeline, formatPeriodRange } from './timeline.rules';
import type { NoticePeriod } from './notices.types';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Asia/Seoul';
});

afterAll(() => {
  // WHY: Node stringifies env values, so assigning undefined would leave TZ as "undefined".
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

// 2026-08-01 12:00 on a Seoul phone.
const now = () => new Date(2026, 7, 1, 12, 0);

function period(
  startDate: string | null,
  endDate: string | null,
  extra: Partial<NoticePeriod> = {},
): NoticePeriod {
  return { label: null, startDate, startTime: null, endDate, endTime: null, ...extra };
}

describe('formatPeriodRange', () => {
  it('runs in the KST zone', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).toBe(-540);
  });

  it('drops the year for this year and keeps it otherwise', () => {
    // Assert
    expect(formatPeriodRange(period('2026-08-03', '2026-08-07'), 2026)).toBe('8.3 ~ 8.7');
    expect(formatPeriodRange(period('2025-08-03', '2025-08-07'), 2026)).toBe('25.8.3 ~ 25.8.7');
  });

  it('shows one day once, with its times', () => {
    // Assert
    expect(formatPeriodRange(period('2026-08-07', '2026-08-07'), 2026)).toBe('8.7');
    expect(
      formatPeriodRange(period('2026-08-07', '2026-08-07', { startTime: '14:00', endTime: '17:00' }), 2026),
    ).toBe('8.7 14:00 ~ 17:00');
    expect(formatPeriodRange(period('2026-08-07', '2026-08-07', { startTime: '14:00' }), 2026)).toBe('8.7 14:00');
  });

  it('marks an open end or an open start with a bare tilde', () => {
    // Assert
    expect(formatPeriodRange(period(null, '2026-08-24', { endTime: '18:00' }), 2026)).toBe('~8.24 18:00');
    expect(formatPeriodRange(period('2026-08-31', null), 2026)).toBe('8.31~');
  });

  it('gives null for a period with no date', () => {
    // Assert
    expect(formatPeriodRange(period(null, null), 2026)).toBeNull();
  });
});

describe('buildNoticeTimeline', () => {
  it('marks past, current and future periods and highlights the nearest deadline', () => {
    // Arrange
    const periods = [
      period('2026-07-20', '2026-07-25', { label: '1차' }),
      period('2026-07-28', '2026-08-05', { label: '2차' }),
      period('2026-08-03', '2026-08-07', { label: '3차' }),
    ];

    // Act
    const timeline = buildNoticeTimeline(periods, now());

    // Assert
    expect(timeline.entries).toEqual([
      { label: '1차', range: '7.20 ~ 7.25', status: 'past', isHighlighted: false },
      { label: '2차', range: '7.28 ~ 8.5', status: 'current', isHighlighted: true },
      { label: '3차', range: '8.3 ~ 8.7', status: 'future', isHighlighted: false },
    ]);
  });

  it('keeps a deadline without a start in the future, not current', () => {
    // Act
    const timeline = buildNoticeTimeline([period(null, '2026-08-24')], now());

    // Assert
    expect(timeline.entries).toEqual([{ label: null, range: '~8.24', status: 'future', isHighlighted: true }]);
  });

  it('makes an open-ended period current once started, and never highlights it', () => {
    // Act
    const timeline = buildNoticeTimeline([period('2026-07-31', null)], now());

    // Assert
    expect(timeline.entries).toEqual([{ label: null, range: '7.31~', status: 'current', isHighlighted: false }]);
  });

  it('treats a date-only end as open until the day ends', () => {
    // Act
    const timeline = buildNoticeTimeline([period('2026-07-30', '2026-08-01')], now());

    // Assert
    expect(timeline.entries[0]).toMatchObject({ status: 'current', isHighlighted: true });
  });

  it('drops a period with no date while highlighting by the original index', () => {
    // Arrange
    const periods = [period(null, null, { label: 'none' }), period('2026-08-10', '2026-08-12')];

    // Act
    const timeline = buildNoticeTimeline(periods, now());

    // Assert
    expect(timeline.entries).toEqual([
      { label: null, range: '8.10 ~ 8.12', status: 'future', isHighlighted: true },
    ]);
  });

  it('lists a notice in date order with the application deadline first', () => {
    // Arrange: skku-main 140602, periods in body order as GET /notices/skku-main/140602 served them.
    const periods = [
      period('2026-10-28', '2026-10-28', { label: '공인회계사시험', startTime: '15:00', endTime: '16:30' }),
      period('2026-11-04', '2026-11-04', { label: '행정고시, 외교관후보자선발시험', startTime: '15:00', endTime: '17:10' }),
      period('2026-10-30', '2026-10-30', { label: '변리사시험', startTime: '15:00', endTime: '16:30' }),
      period('2026-11-06', '2026-11-06', { label: '기술고시', startTime: '13:30', endTime: '15:30' }),
      period(null, '2026-10-25', { label: '참가신청' }),
    ];

    // Act
    const timeline = buildNoticeTimeline(periods, new Date(2026, 9, 24, 12, 0));

    // Assert
    expect(timeline.entries).toEqual([
      { label: '참가신청', range: '~10.25', status: 'future', isHighlighted: true },
      { label: '공인회계사시험', range: '10.28 15:00 ~ 16:30', status: 'future', isHighlighted: false },
      { label: '변리사시험', range: '10.30 15:00 ~ 16:30', status: 'future', isHighlighted: false },
      { label: '행정고시, 외교관후보자선발시험', range: '11.4 15:00 ~ 17:10', status: 'future', isHighlighted: false },
      { label: '기술고시', range: '11.6 13:30 ~ 15:30', status: 'future', isHighlighted: false },
    ]);
  });

  it('keeps steps that start at the same moment in body order', () => {
    // Arrange
    const periods = [
      period('2026-08-20', '2026-08-20', { label: '오리엔테이션' }),
      period('2026-08-10', '2026-08-10', { label: '1차 납부' }),
      period('2026-08-10', '2026-08-10', { label: '2차 납부' }),
      period('2026-08-12', '2026-08-14', { label: '서류 제출' }),
      period('2026-08-12', '2026-08-13', { label: '면접' }),
    ];

    // Act
    const timeline = buildNoticeTimeline(periods, now());

    // Assert
    expect(timeline.entries.map((e) => e.label)).toEqual(['1차 납부', '2차 납부', '서류 제출', '면접', '오리엔테이션']);
  });

  it('places a deadline-only period at its deadline, a date-only one at the start of its day', () => {
    // Arrange
    const periods = [
      period('2026-08-20', '2026-08-21', { label: 'event' }),
      period('2026-08-15', '2026-08-15', { label: 'talk', startTime: '14:00' }),
      period(null, '2026-08-15', { label: 'apply' }),
      period('2026-08-10', '2026-08-11', { label: 'early' }),
    ];

    // Act
    const timeline = buildNoticeTimeline(periods, now());

    // Assert
    expect(timeline.entries.map((e) => e.label)).toEqual(['early', 'apply', 'talk', 'event']);
  });

  it('highlights the nearest deadline after it moves and an undated period drops', () => {
    // Arrange
    const periods = [
      period(null, null, { label: 'none' }),
      period('2026-08-20', '2026-08-25', { label: 'later' }),
      period('2026-08-03', '2026-08-05', { label: 'nearest' }),
    ];

    // Act
    const timeline = buildNoticeTimeline(periods, now());

    // Assert
    expect(timeline.entries.map((e) => [e.label, e.isHighlighted])).toEqual([
      ['nearest', true],
      ['later', false],
    ]);
  });
});
