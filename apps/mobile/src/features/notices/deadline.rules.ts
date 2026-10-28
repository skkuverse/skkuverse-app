import {
  diffDays,
  formatHourMinute,
  parseLocalDate,
  startOfLocalDay,
  toEffectiveDateTime,
} from './notice-date.rules';
import type { NoticeEndAt, NoticeListItemSummary, NoticeStartAt } from './notices.types';

export type DeadlineVariant =
  | 'urgent'
  | 'normal'
  | 'closed'
  | 'eventToday'
  | 'inProgress'
  | 'upcoming';

export interface DeadlinePill {
  text: string;
  variant: DeadlineVariant;
}

export interface DeadlineInfo {
  pill: DeadlinePill;
  context: string | null;
}

function formatMonthDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

function actionRequiredBadge(
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineInfo | null {
  if (!endAt?.date) return null;

  const endDT = toEffectiveDateTime(endAt.date, endAt.time);
  const todayStart = startOfLocalDay(now);
  const endStart = startOfLocalDay(parseLocalDate(endAt.date));
  const d = diffDays(todayStart, endStart);

  const label = endAt.label || null;
  const isPast = endDT.getTime() < now.getTime();

  let pill: DeadlinePill;

  if (isPast) {
    pill = { text: '마감', variant: 'closed' };
  } else if (d === 0 && endAt.time) {
    pill = {
      text: `오늘 ${formatHourMinute(endAt.time)}`,
      variant: 'urgent',
    };
  } else if (d === 0) {
    pill = { text: 'D-0', variant: 'urgent' };
  } else if (d <= 3) {
    pill = { text: `D-${d}`, variant: 'urgent' };
  } else {
    pill = { text: `D-${d}`, variant: 'normal' };
  }

  // WHY: a past deadline drops its label, since an ordinal label beside "closed" is ambiguous (is
  // round 2 closed, or next?); the detail screen still shows it.
  const context = label && !isPast ? `${label}까지` : null;

  return { pill, context };
}

function eventBadge(
  startAt: NoticeStartAt | null,
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineInfo | null {
  const anchorDate = endAt?.date ?? startAt?.date ?? null;
  const anchorTime = endAt?.time ?? startAt?.time ?? null;
  if (!anchorDate) return null;

  const anchorDT = toEffectiveDateTime(anchorDate, anchorTime);
  if (anchorDT.getTime() < now.getTime()) return null;

  const d = diffDays(
    startOfLocalDay(now),
    startOfLocalDay(parseLocalDate(anchorDate)),
  );

  let pill: DeadlinePill;
  if (d === 0 && anchorTime) {
    pill = {
      text: `오늘 ${formatHourMinute(anchorTime)}`,
      variant: 'eventToday',
    };
  } else if (d === 0) {
    pill = { text: '오늘', variant: 'eventToday' };
  } else {
    pill = { text: `D-${d}`, variant: 'normal' };
  }
  return { pill, context: null };
}

function informationalBadge(
  startAt: NoticeStartAt | null,
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineInfo | null {
  const start = startAt?.date ?? null;
  const end = endAt?.date ?? null;

  // WHY: a single date, a start alone or an end alone shows no badge; the detail screen covers it.
  if (!start || !end) return null;
  // WHY: a same-day event shows no badge in the list.
  if (start === end) return null;

  const todayStart = startOfLocalDay(now);
  const startStart = startOfLocalDay(parseLocalDate(start));
  const endStart = startOfLocalDay(parseLocalDate(end));

  if (todayStart < startStart) {
    const d = diffDays(todayStart, startStart);
    return {
      pill: { text: `D-${d}`, variant: 'upcoming' },
      context: '시작까지',
    };
  }
  if (todayStart <= endStart) {
    return {
      pill: {
        text: `진행 중 ~${formatMonthDay(end)}`,
        variant: 'inProgress',
      },
      context: null,
    };
  }
  return null;
}

export function formatDeadlineBadge(
  summary: NoticeListItemSummary | null,
  now: Date,
): DeadlineInfo | null {
  if (!summary) return null;
  const { type, startAt, endAt } = summary;

  switch (type) {
    case 'action_required':
      return actionRequiredBadge(endAt, now);
    case 'event':
      return eventBadge(startAt, endAt, now);
    case 'informational':
      return informationalBadge(startAt, endAt, now);
  }
}
