// WHY: the server ships every language it holds, since a building and a booth carry different sets;
// the pick happens here, once, so the caption, the list row and the sheet never diverge.

import cliTruncate from 'cli-truncate';
import stringWidth from 'string-width';
import wrapAnsi from 'wrap-ansi';

import type { AppLanguage } from '../store/settings';
import type { I18nText } from './i18n-text.rules';

/**
 * WHY: `||`, not `??`: a missing translation upstream is the empty string, which TypeScript cannot
 * flag because `en` is non-optional.
 */
export function pickI18nText(text: I18nText, lang: AppLanguage): string {
  if (lang === 'en') return text.en || text.ko;
  if (lang === 'zh') return text.zh || text.ko;
  return text.ko;
}

/**
 * WHY: a test, never a transform: it decides whether the hard pass may run. Latin, digits and
 * punctuation are absent, since they must not split mid-token.
 */
const WIDE = /[ᄀ-ᇿ　-〿぀-ヿ㄰-㆏㐀-䶿一-鿿가-힣＀-￯]/;

/**
 * QUIRK(naver-map): the native caption wraps only at whitespace, and many Korean names have none, so the
 * breaks go in the string: soft first, then hard only on an overflowing line holding a wide character, so a
 * Latin word never splits. `cols` counts display columns, a Hangul syllable 2.
 */
export function wrapMarkerLabel(text: string, cols: number, maxLines: number): string {
  // WHY: `cols: 0` is reachable from a bad wire `style`, and `wrap-ansi` would spin on it.
  if (!text || cols < 1 || maxLines < 1) return text;
  // QUIRK(naver-map): the SDK hashes the caption object into `caption.key` and short-circuits on it,
  // so return the identical string, not a rebuilt equal one.
  if (stringWidth(text) <= cols) return text;

  const lines = wrapAnsi(text, cols, { hard: false, trim: true })
    .split('\n')
    .flatMap((line) =>
      stringWidth(line) > cols && WIDE.test(line)
        ? wrapAnsi(line, cols, { hard: true, trim: true }).split('\n')
        : [line],
    );

  if (lines.length <= maxLines) return lines.join('\n');

  // WHY: truncating the joined rest keeps the last line full; slicing whole lines would leave it short.
  const head = lines.slice(0, maxLines - 1);
  const tail = cliTruncate(lines.slice(maxLines - 1).join(' '), cols);
  return [...head, tail].join('\n');
}

export function markerLabelColumns(text: string): number {
  return Math.max(0, ...text.split('\n').map((line) => stringWidth(line)));
}
