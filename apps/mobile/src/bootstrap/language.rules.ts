import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type AppLanguage } from '@skkuverse/shared';

// WHY: the whole preference list, not its first entry, so an unsupported top language falls to the user's next one.
export function resolveAppLanguage(locales: readonly { languageCode: string | null }[]): AppLanguage {
  const supported = SUPPORTED_LANGUAGES as readonly string[];
  for (const locale of locales) {
    const code = locale.languageCode;
    if (code && supported.includes(code)) {
      return code as AppLanguage;
    }
  }
  return DEFAULT_LANGUAGE;
}

// WHY: Chinese falls to English, not Korean, until notifications ship in Chinese; Settings explains it.
export function toNotificationLocale(lang: AppLanguage): 'ko' | 'en' {
  return lang === 'ko' ? 'ko' : 'en';
}
