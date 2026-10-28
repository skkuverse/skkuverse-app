/**
 * WHY: every language the server holds, not the `Accept-Language` match: a building and a booth carry
 * different sets in one schema. `en` has already fallen back to `ko` upstream.
 */
export interface I18nText {
  ko: string;
  en: string;
  zh?: string;
}

/**
 * WHY: `ko` is the source language and always present upstream, so its absence is a broken record
 * and reads as null; a missing `zh` is the normal case.
 */
export function parseI18nText(raw: unknown): I18nText | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const ko = typeof t.ko === 'string' ? t.ko : '';
  if (ko === '') return null;
  const en = typeof t.en === 'string' && t.en !== '' ? t.en : ko;
  const zh = typeof t.zh === 'string' && t.zh !== '' ? t.zh : undefined;
  return zh ? { ko, en, zh } : { ko, en };
}
