import { useCallback } from 'react';
import { translations } from './translations';
import type { TranslationKey } from './translations';
import type { AppLanguage } from '../store/settings';
import { useSettingsStore } from '../store/settings';

export type { TranslationKey } from './translations';
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './constants';

export function t(lang: AppLanguage, key: TranslationKey): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export function tpl(
  lang: AppLanguage,
  key: TranslationKey,
  ...args: (string | number)[]
): string {
  let result = t(lang, key);
  for (let i = 0; i < args.length; i++) {
    result = result.replace(`{${i}}`, String(args[i]));
  }
  return result;
}

export function useT() {
  const lang = useSettingsStore((s) => s.appLanguage);
  const boundT = useCallback((key: TranslationKey) => t(lang, key), [lang]);
  const boundTpl = useCallback(
    (key: TranslationKey, ...args: (string | number)[]) => tpl(lang, key, ...args),
    [lang],
  );
  return { t: boundT, tpl: boundTpl };
}
