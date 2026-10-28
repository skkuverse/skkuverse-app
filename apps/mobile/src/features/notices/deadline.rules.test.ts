/**
 * The list cell's deadline badge, every variant, as it reads today on a phone
 * in Seoul. Each case passes its own instant.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatDeadlineBadge } from './deadline.rules';
import type { NoticeListItemSummary } from './notices.types';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Asia/Seoul';
});

afterAll(() => {
  // WHY: Node stringifies env values, so assigning undefined would leave TZ as "undefined".
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

// 2026-04-11 12:00 on a Seoul phone.
const now = () => new Date(2026, 3, 11, 12, 0);

function summary(
  type: NoticeListItemSummary['type'],
  startAt: NoticeListItemSummary['startAt'],
  endAt: NoticeListItemSummary['endAt'],
): NoticeListItemSummary {
  return { oneLiner: null, type, startAt, endAt };
}

const end = (date: string | null, time: string | null = null, label: string | null = null) => ({
  date,
  time,
  label,
});
const start = (date: string | null, time: string | null = null) => ({ date, time });

describe('formatDeadlineBadge', () => {
  it('runs in the KST zone', () => {
    // Assert
    expect(new Date(0).getTimezoneOffset()).toBe(-540);
  });

  it('shows no badge without a summary', () => {
    // Assert
    expect(formatDeadlineBadge(null, now())).toBeNull();
  });

  describe('action_required', () => {
    it('is urgent three days out, with the label as context', () => {
      // Act
      const badge = formatDeadlineBadge(summary('action_required', null, end('2026-04-14', null, '1차 신청')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-3', variant: 'urgent' }, context: '1차 신청까지' });
    });

    it('is normal four days out', () => {
      // Act
      const badge = formatDeadlineBadge(summary('action_required', null, end('2026-04-15')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-4', variant: 'normal' }, context: null });
    });

    it('is D-0 on a date-only deadline due today', () => {
      // Act
      const badge = formatDeadlineBadge(summary('action_required', null, end('2026-04-11')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-0', variant: 'urgent' }, context: null });
    });

    it('shows the time on a deadline later today', () => {
      // Act
      const badge = formatDeadlineBadge(
        summary('action_required', null, end('2026-04-11', '17:00:00', 'label')),
        now(),
      );

      // Assert
      expect(badge).toEqual({ pill: { text: '오늘 17:00', variant: 'urgent' }, context: 'label까지' });
    });

    it('is closed once the deadline passed, dropping the label', () => {
      // Act
      const badge = formatDeadlineBadge(
        summary('action_required', null, end('2026-04-11', '09:00:00', '2차 신청')),
        now(),
      );

      // Assert
      expect(badge).toEqual({ pill: { text: '마감', variant: 'closed' }, context: null });
    });

    it('shows no badge without an end date', () => {
      // Assert
      expect(formatDeadlineBadge(summary('action_required', null, end(null)), now())).toBeNull();
      expect(formatDeadlineBadge(summary('action_required', null, null), now())).toBeNull();
    });

    it('turns an unparsable date into D-NaN, as it does today', () => {
      // Act
      const badge = formatDeadlineBadge(summary('action_required', null, end('soon')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-NaN', variant: 'normal' }, context: null });
    });
  });

  describe('event', () => {
    it('counts days to the event', () => {
      // Act
      const badge = formatDeadlineBadge(summary('event', start('2026-04-15', '19:00:00'), null), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-4', variant: 'normal' }, context: null });
    });

    it('is eventToday with its time on the day', () => {
      // Act
      const badge = formatDeadlineBadge(summary('event', start('2026-04-11', '19:00:00'), null), now());

      // Assert
      expect(badge).toEqual({ pill: { text: '오늘 19:00', variant: 'eventToday' }, context: null });
    });

    it('is eventToday without a time on the day', () => {
      // Act
      const badge = formatDeadlineBadge(summary('event', null, end('2026-04-11')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: '오늘', variant: 'eventToday' }, context: null });
    });

    it('anchors on the end when there is one', () => {
      // Act
      const badge = formatDeadlineBadge(summary('event', start('2026-04-12'), end('2026-04-13')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-2', variant: 'normal' }, context: null });
    });

    it('shows no badge once the event passed', () => {
      // Assert
      expect(formatDeadlineBadge(summary('event', start('2026-04-11', '09:00:00'), null), now())).toBeNull();
    });
  });

  describe('informational', () => {
    it('counts down to the start before it begins', () => {
      // Act
      const badge = formatDeadlineBadge(summary('informational', start('2026-04-13'), end('2026-04-26')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: 'D-2', variant: 'upcoming' }, context: '시작까지' });
    });

    it('is in progress through its end date', () => {
      // Act
      const badge = formatDeadlineBadge(summary('informational', start('2026-04-09'), end('2026-05-01')), now());

      // Assert
      expect(badge).toEqual({ pill: { text: '진행 중 ~5/1', variant: 'inProgress' }, context: null });
    });

    it('shows no badge after its end, on a single day, or without both dates', () => {
      // Assert
      expect(formatDeadlineBadge(summary('informational', start('2026-04-01'), end('2026-04-10')), now())).toBeNull();
      expect(formatDeadlineBadge(summary('informational', start('2026-04-09'), end('2026-04-09')), now())).toBeNull();
      expect(formatDeadlineBadge(summary('informational', start('2026-04-13'), null), now())).toBeNull();
      expect(formatDeadlineBadge(summary('informational', null, end('2026-04-26')), now())).toBeNull();
    });
  });
});
