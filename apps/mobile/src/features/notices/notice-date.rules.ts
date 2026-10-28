/**
 * WHY: every day here is a KST calendar day, derived from the epoch, so a phone set to another zone reads
 * "today" and D-n as one in Seoul does. "Local" in the names means the notice's calendar, KST.
 */
import { KST_OFFSET_MS } from '@skkuverse/shared';

const MS_PER_DAY = 86_400_000;

/** WHY: arithmetic, not `kstDate`: an unparsable server date must come out NaN, not throw from `toISOString`. */
export function startOfLocalDay(d: Date): number {
  const t = d.getTime();
  return t - ((((t + KST_OFFSET_MS) % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
}

/** WHY: not `new Date('YYYY-MM-DD')`, which parses as UTC midnight, nine hours after KST midnight. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1) - KST_OFFSET_MS);
}

/** WHY: a date with no time lasts until 23:59:59.999 KST, since "until the 7th" means until it ends. */
export function toEffectiveDateTime(date: string, time: string | null): Date {
  const start = parseLocalDate(date).getTime();
  if (!time) return new Date(start + MS_PER_DAY - 1);
  const parts = time.split(':').map(Number);
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  const ss = parts[2] ?? 0;
  return new Date(start + ((hh * 60 + mm) * 60 + ss) * 1000);
}

export function diffDays(fromStartMs: number, toStartMs: number): number {
  return Math.round((toStartMs - fromStartMs) / 86_400_000);
}

export function formatHourMinute(time: string): string {
  const parts = time.split(':');
  const hh = Number(parts[0] ?? 0);
  const mm = parts[1] ?? '00';
  return `${hh}:${mm.padStart(2, '0')}`;
}

/**
 * CONTRACT(skkuverse-crawler): skkuverse-crawler/py/src/skkuverse_crawler/modules/notices/models.py
 * holds only a posting date, and `crawledAt` is not the posting time, so a same-day notice shows its date.
 */
export function formatListDate(date: string): string {
  const parts = date.split('-');
  if (parts.length < 3) return '';
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

export function formatDisplayDate(date: string): string {
  return date.slice(2).replace(/-/g, '.');
}
