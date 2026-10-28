/**
 * WHY: derived from the epoch, never `Date.getHours()`: Asia/Seoul has had no DST since 1988, so the
 * offset is fixed and a phone set to another zone still reads the right KST minute and day.
 */
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
export const KST_OFFSET_MS = 9 * 60 * MS_PER_MINUTE;

export function msIntoKstDay(now: number): number {
  // WHY: double modulo, so a negative `now` (a fake clock, a device set before 1970) still lands in
  // [0, MS_PER_DAY).
  return (((now + KST_OFFSET_MS) % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
}

export function kstMinutesOfDay(now: number): number {
  return Math.floor(msIntoKstDay(now) / MS_PER_MINUTE);
}

export function kstDate(now: number): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * WHY: strict, as the server is: `"7:00"` and `"24:00"` are refused, so one spelling of an hour and
 * of midnight (`"00:00"`) arrives.
 */
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMinutesOfDay(hhmm: string): number | null {
  const m = HHMM_RE.exec(hhmm);
  if (m === null) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
