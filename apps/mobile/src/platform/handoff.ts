import { Linking, Platform, Share, type ShareContent, type ShareOptions } from 'react-native';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { logHandledError } from './crashlytics';
import { handoffFor, type HandoffKind, type HandoffMark } from './handoff.rules';

// WHY: the root ESLint config allows these APIs only here, so each marks the hand-off first and the
// next `app_foreground` says why the app was left. An API with no wrapper calls `markHandoff` right before.

let pending: HandoffMark | null = null;

export function markHandoff(kind: HandoffKind, now: number = Date.now()): void {
  pending = { kind, at: now };
}

/** WHY: clears the mark either way, so one mark tags at most one return. */
export function takeHandoff(backgroundedAt: number): HandoffKind | undefined {
  const kind = handoffFor(pending, backgroundedAt);
  pending = null;
  return kind;
}

export function openExternalUrl(url: string): Promise<unknown> {
  markHandoff('external');
  return Linking.openURL(url);
}

export function openInAppBrowser(
  url: string,
  options?: WebBrowser.WebBrowserOpenOptions,
): Promise<WebBrowser.WebBrowserResult> {
  markHandoff('browser');
  return WebBrowser.openBrowserAsync(url, options);
}

export function shareContent(content: ShareContent, options?: ShareOptions) {
  markHandoff('share');
  return Share.share(content, options);
}

export function openAppSettings(): Promise<void> {
  markHandoff('settings');
  return Linking.openSettings();
}

export function sendSettingsIntent(
  action: string,
  extras?: Parameters<typeof Linking.sendIntent>[1],
): Promise<void> {
  markHandoff('settings');
  return Linking.sendIntent(action, extras);
}

/**
 * QUIRK(android): ACTION_APP_NOTIFICATION_SETTINGS opens the per-app notification page, one tap closer
 * than openSettings, which stays the fallback where no activity handles it. iOS opens only the app's
 * root Settings page.
 */
export async function openOsSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await openAppSettings();
    } catch (e) {
      logHandledError('openOsSettings/ios-linking', e);
    }
    return;
  }
  const packageName = Application.applicationId;
  if (packageName) {
    try {
      await sendSettingsIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
        { key: 'android.provider.extra.APP_PACKAGE', value: packageName },
      ]);
      return;
    } catch (e) {
      logHandledError('openOsSettings/android-intent', e);
    }
  }
  try {
    await openAppSettings();
  } catch (e) {
    logHandledError('openOsSettings/android-linking', e);
  }
}
