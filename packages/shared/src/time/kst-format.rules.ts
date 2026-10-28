/**
 * WHY: built from the epoch, not `Intl`: the phone's own zone, `ko-KR`'s `10. 1.` shape and `24:00`
 * at midnight on some engines all go wrong there. Every shown time carries its date.
 */
import type { TranslationKey } from '../i18n/translations';
import { toEpochMs } from './epoch.rules';
import { KST_OFFSET_MS } from './kst.rules';

type Translate = (key: TranslationKey) => string;

const WEEKDAY_KEYS: readonly TranslationKey[] = [
  'day.sun',
  'day.mon',
  'day.tue',
  'day.wed',
  'day.thu',
  'day.fri',
  'day.sat',
];

/** WHY: its UTC fields read as the KST wall clock; never format it with a local getter. */
function kstFields(epochMs: number): Date {
  return new Date(epochMs + KST_OFFSET_MS);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatKstTime(epochMs: number): string {
  const d = kstFields(epochMs);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function formatKstDate(epochMs: number, t: Translate): string {
  const d = kstFields(epochMs);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${t(WEEKDAY_KEYS[d.getUTCDay()])})`;
}

export function formatKstDateTime(epochMs: number, t: Translate): string {
  return `${formatKstDate(epochMs, t)} ${formatKstTime(epochMs)}`;
}

/**
 * WHY: the start decides the date, so an 18:00–00:00 window is dated by its evening; an open end is a
 * bare `~`, as organisers write it, never an invented close.
 */
export function formatTimeWindow(
  // WHY: structural, so time/ needs no map type; an opening window's label is not read here.
  w: { readonly startAt: string; readonly endAt: string | null; readonly label?: unknown },
  t: Translate,
): string | null {
  const start = toEpochMs(w.startAt);
  if (start === null) return null;
  if (w.endAt === null) return `${formatKstDateTime(start, t)}~`;
  const end = toEpochMs(w.endAt);
  if (end === null) return null;
  return `${formatKstDateTime(start, t)}~${formatKstTime(end)}`;
}
