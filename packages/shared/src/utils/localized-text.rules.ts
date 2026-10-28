export interface LocalizedText {
  ko: string;
  en: string;
}

export function getLocalizedText(
  text: LocalizedText | undefined,
  lang: string,
): string {
  if (!text) return '';
  return lang === 'en' ? text.en || text.ko : text.ko;
}
