/**
 * WHY: the server sends `color` as hex without `#`, which React Native reads as black. Anything not bare hex
 * passes through untouched, which is why this is not `hexToColor` from `@skkuverse/shared`.
 */

const BARE_HEX_RE = /^[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?$/;

export function toCssColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  return BARE_HEX_RE.test(raw) ? `#${raw}` : raw;
}
