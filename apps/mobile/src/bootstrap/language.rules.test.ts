/**
 * The app language follows the device's preference list: the first language
 * the app supports wins, in the user's order, and English covers a list with
 * none. Notifications ship in Korean and English only, so every other app
 * language is notified in English.
 */

import { describe, it, expect } from 'vitest';
import { resolveAppLanguage, toNotificationLocale } from './language.rules';

const locales = (...codes: (string | null)[]) => codes.map((languageCode) => ({ languageCode }));

describe('resolveAppLanguage', () => {
  it.each([
    ['the top language when the app supports it', locales('ko', 'en'), 'ko'],
    ['Chinese, which the app supports', locales('zh', 'ko'), 'zh'],
    ['the next supported language after an unsupported top one', locales('fr', 'ja', 'ko', 'en'), 'ko'],
    ['past a locale with no language code', locales(null, 'en'), 'en'],
    ['English when no language is supported', locales('fr', 'de'), 'en'],
    ['English for an empty list', locales(), 'en'],
  ])('picks %s', (_case, list, expected) => {
    // Act & Assert
    expect(resolveAppLanguage(list)).toBe(expected);
  });
});

describe('toNotificationLocale', () => {
  it.each([
    ['ko', 'ko'],
    ['en', 'en'],
    ['zh', 'en'],
  ] as const)('notifies %s in %s', (lang, locale) => {
    // Act & Assert
    expect(toNotificationLocale(lang)).toBe(locale);
  });
});
