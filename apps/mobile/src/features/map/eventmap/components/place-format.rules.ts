/** WHY: the list row and the sheet's summary must never disagree about whether a place is open, so both read these. */

import {
  formatKstDateTime,
  formatTimeWindow,
  pickI18nText,
  type AppLanguage,
  type BgColorName,
  type FgColorName,
  type TranslationKey,
} from '@skkuverse/shared';
import { currentOpenRun, isOpenNow, nextOpeningAfter } from '../../opening-hours.rules';
import type { OpeningWindow } from '../../overlay.types';

export type Openness = 'open' | 'upcoming' | 'closed';

export const STATUS_LABEL: Record<Openness, TranslationKey> = {
  open: 'eventmap.status.open',
  upcoming: 'eventmap.status.upcoming',
  closed: 'eventmap.status.closed',
};

export const STATUS_ROLES: Record<Openness, { color: FgColorName; backgroundColor: BgColorName }> = {
  open: { color: 'brand', backgroundColor: 'neutralWeak' },
  upcoming: { color: 'neutralMuted', backgroundColor: 'neutralWeak' },
  closed: { color: 'neutralSubtle', backgroundColor: 'neutralWeak' },
};

/**
 * WHY: derived, never carried: a cached status disagreed with its own hours once the clock passed a boundary.
 * No `unknown` state: an empty `hours` is always open, and a cancelled place is not served.
 */
export function opennessOf(hours: readonly OpeningWindow[], now: number): Openness {
  if (isOpenNow(hours, now)) return 'open';
  return nextOpeningAfter(hours, now) === null ? 'closed' : 'upcoming';
}

/**
 * WHY: formatted here, not served, so it follows the app's language; every window is dated, since a
 * festival runs on two days and `18:00–23:00` alone does not say which.
 */
export function formatHours(
  hours: readonly OpeningWindow[],
  t: (key: TranslationKey) => string,
  lang: AppLanguage,
  always: string,
): string {
  if (hours.length === 0) return always;
  return formatHoursLines(hours, t, lang).join(', ');
}

export function formatHoursLines(
  hours: readonly OpeningWindow[],
  t: (key: TranslationKey) => string,
  lang: AppLanguage,
): string[] {
  return hours.flatMap((w) => {
    const time = formatTimeWindow(w, t);
    if (time === null) return [];
    return w.label ? `${pickI18nText(w.label, lang)} · ${time}` : time;
  });
}

/** WHY: dated like every other time on the map; a bare `18:00` at 02:00 between two nights names no evening. */
export function statusLineOf(
  hours: readonly OpeningWindow[],
  now: number,
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): { text: string; color: FgColorName } {
  if (hours.length === 0) return { text: t('eventmap.hours.always'), color: 'brand' };

  // WHY: the run, not the window: touching windows are one stretch of being open.
  const run = currentOpenRun(hours, now);
  if (run) {
    return {
      text:
        run.until === null
          ? t('eventmap.status.openNoEnd')
          : tpl('eventmap.status.openUntil', formatKstDateTime(run.until, t)),
      color: 'brand',
    };
  }

  const next = nextOpeningAfter(hours, now);
  if (next !== null) {
    return {
      text: tpl('eventmap.status.opensAt', formatKstDateTime(next, t)),
      color: 'neutralMuted',
    };
  }
  return { text: t('eventmap.status.closed'), color: 'neutralSubtle' };
}
