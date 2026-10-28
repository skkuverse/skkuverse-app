import Constants from 'expo-constants';

/**
 * WHY: app.config.ts `resolveBaseUrl()` writes `extra.baseUrl` and ignores the environment on a
 * shipping profile.
 */
const extra = Constants.expoConfig?.extra as { baseUrl?: string } | undefined;

// WHY: a whitespace-only value is an env var that never got substituted, so it counts as missing.
const baseUrl = extra?.baseUrl?.trim();

// EVIDENCE: a silent default host let OTA builds talk to the wrong API host unnoticed for months, so
// there is no fallback; throwing at module init stops the bundle before any screen renders.
if (!baseUrl) {
  throw new Error(
    '`extra.baseUrl` is missing from the Expo config. app.config.ts always ' +
      'writes it — resolveBaseUrl() returns PROD_API_URL from ' +
      'apps/mobile/config/constants.js — so reaching this line means the ' +
      'bundle is running against a manifest produced before that was true: ' +
      'an OTA update published on the production/1.0.0 or production/3.5.0 ' +
      'runtime channel, or a binary built from a broken config. There is no ' +
      'fallback host by design: a silent default let builds talk to the ' +
      'wrong API host unnoticed for months.',
  );
}

export const ApiConfig = {
  baseUrl,
} as const;
