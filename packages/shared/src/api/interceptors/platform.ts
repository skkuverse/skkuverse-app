import type { InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

let cachedLocale: string | null = null;
let cachedVersion: string | null = null;
let cachedPlatform: string | null = null;

function resolveLocale(): string {
  const locales = getLocales();
  const lang = locales[0]?.languageCode ?? 'en';
  switch (lang) {
    case 'ko':
      return 'ko';
    case 'zh':
      return 'zh';
    default:
      return 'en';
  }
}

export function platformInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  cachedPlatform ??= Platform.OS === 'ios' ? 'ios' : 'android';
  cachedVersion ??= Constants.expoConfig?.version ?? 'unknown';
  cachedLocale ??= resolveLocale();

  config.headers.set('Accept-Language', cachedLocale);
  config.headers.set('X-App-Version', cachedVersion);
  config.headers.set('X-Platform', cachedPlatform);

  return config;
}
