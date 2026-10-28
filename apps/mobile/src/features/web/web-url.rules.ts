/**
 * QUIRK(ios): ATS blocks cleartext http and the WebView shows a blank page, so http is upgraded; a non-web scheme
 * goes to the OS.
 */

export interface NormalizedUrl {
  url: string;
  isWeb: boolean;
}

export function normalizeWebUrl(raw: string): NormalizedUrl {
  const trimmed = (raw ?? '').trim();
  const url = trimmed.startsWith('http://')
    ? `https://${trimmed.slice('http://'.length)}`
    : trimmed;
  return { url, isWeb: url.startsWith('https://') };
}
