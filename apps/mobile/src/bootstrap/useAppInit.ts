import { useEffect, useState } from 'react';
import { getAuth, getIdToken, onAuthStateChanged } from '@react-native-firebase/auth';
import { getLocales } from 'expo-localization';
import {
  setAuthTokenProvider,
  getApiClient,
  authStore,
  useEngagementStore,
  useSettingsStore,
  useNotificationStore,
  useBookmarkStore,
  setDropReporter,
  t as translate,
  withRetry,
} from '@skkuverse/shared';
import type { PreferencesDocument } from '@skkuverse/shared';
import mobileAds from 'react-native-google-mobile-ads';
import { setCrashlyticsUserId, logHandledError, logSchemaDrop } from '@/platform/crashlytics';
import {
  anonymousSession,
  configureGoogleSignIn,
  requireSession,
  syncProfileFromProviderData,
} from '@/features/auth/auth.service';
import {
  disableAnalyticsInDev,
  markFirstLaunch,
  setAnalyticsContext,
  setAnalyticsUserId,
  setAppLanguage,
  setAuthState,
  setPreferredCampus,
  syncNotificationPermission,
} from '@/platform/analytics';
import { setupAppCheck } from '@/platform/app-check';
import { setLogLevel } from '@react-native-firebase/firestore';
import { setupNotificationChannels } from '@/bootstrap/notifications/notifications.service';
import { createRetryingListener } from '@/bootstrap/listener-retry.rules';
import { resolveAppLanguage, toNotificationLocale } from '@/bootstrap/language.rules';
import { useForegroundSync } from '@/bootstrap/useForegroundSync';
import { checkPermission, onTokenRefresh } from '@/platform/messaging';
import { getOrCreateDeviceId } from '@/platform/device-id';
import {
  ensurePreferencesDoc,
  onPreferencesChanged,
  registerSessionGate,
} from '@/features/notifications/notifications.service';
import {
  moveDeviceToCurrentUid,
  registerPushAtLaunch,
  registerRefreshedToken,
} from '@/features/notifications/device/device.service';
import { reapplyMiniAppOptIns, retryPendingMiniAppOptIns } from '@/features/notifications/useMiniAppPush';
import {
  listenToBookmarks,
  onboardingRestore,
  restoreOnboardingFromPreferences,
} from '@/features/notices/notices.service';

// WHY: at module scope, so a cache read during the first render already reports
// a dropped item; without it a release build drops server items without a trace.
setDropReporter(logSchemaDrop);
// WHY: at module scope too, before any screen can take a tap: notifications
// cannot import auth (auth imports it), so its session gate is handed over here.
registerSessionGate(requireSession);

// QUIRK(firebase): the SDK silently parks mutations on some timings; debug logging makes the stall visible.
if (__DEV__) {
  try {
    setLogLevel('debug');
  } catch {
    /* QUIRK(react-native-firebase): some versions throw on this call off module scope. */
  }
}

export function useAppInit() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unsubToken: (() => void) | undefined;
    // WHY: the store does not persist preferences, so this listener is the client's only source for them.
    let unsubPrefs: (() => void) | undefined;
    let prefsListenerUid: string | null = null;
    // WHY: the pending mini-app opt-in retry waits for the launch to finish,
    // then runs on the first signed-in moment (C9 in miniapp-push.rules.ts).
    let launchReady = false;

    let unsubBookmarks: (() => void) | undefined;
    let bookmarksListenerUid: string | null = null;

    function listen<T>(
      subscribe: (onNext: (value: T) => void, onError: (err: unknown) => void) => () => void,
      label: string,
      onNext: (value: T) => void,
    ): () => void {
      return createRetryingListener({
        subscribe,
        onNext,
        onError: (err) => logHandledError(label, err),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      });
    }

    async function init() {
      try {
        // WHY: read before the stamp, so the launch events can say whether this is the install's first process.
        markFirstLaunch(useEngagementStore.getState().firstLaunchAt === 0);
        useEngagementStore.getState().initFirstLaunchIfNeeded();

        await disableAnalyticsInDev();
        setAnalyticsContext();
        void checkPermission().then(syncNotificationPermission);

        // WHY: App Check first, before any Firebase service call, or that call goes out without a token.
        await setupAppCheck();

        configureGoogleSignIn();

        setAuthTokenProvider(async (forceRefresh) => {
          const user = getAuth().currentUser;
          if (!user) return null;
          return getIdToken(user, forceRefresh);
        });

        // WHY: never blocks launch; a failure (the per-IP quota behind a shared NAT, offline, a refused App Check
        // token) leaves the app signed out and retries in the background. SEE: docs/explanation/app-check.md
        await anonymousSession.ensure('cold');

        getApiClient();

        unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
          // WHY: lastKnownUid survives the signed-out state between two users, which is how a uid transition is seen.
          const prevUid = authStore.getState().lastKnownUid;

          if (user) {
            // QUIRK(firebase): linkWithCredential leaves displayName and photoURL null on the Auth record, so they are backfilled.
            await syncProfileFromProviderData(user);

            if (__DEV__) {
              console.log('[auth] onAuthStateChanged:', {
                prevUid,
                newUid: user.uid,
                email: user.email,
                displayName: user.displayName,
                isAnonymous: user.isAnonymous,
                providerData: user.providerData.map((p) => p.providerId),
              });
            }
            authStore.getState().setAuthenticated({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              isAnonymous: user.isAnonymous,
            });
            setAnalyticsUserId(user.uid);
            setAuthState(user.isAnonymous ? 'anon' : 'google');
            setCrashlyticsUserId(user.uid);

            if (prevUid && prevUid !== user.uid) {
              const deviceMoved = moveDeviceToCurrentUid(toNotificationLocale(resolveAppLanguage(getLocales())));
              reapplyMiniAppOptIns(prevUid, user.uid, deviceMoved);
            }

            authStore.setState({ lastKnownUid: user.uid });
            if (launchReady) void retryPendingMiniAppOptIns();

            if (prefsListenerUid !== user.uid) {
              unsubPrefs?.();
              // WHY: the previous uid's choices must not show as this one's before the new listener delivers.
              if (prefsListenerUid !== null) {
                useNotificationStore.getState().resetPreferences();
              }
              prefsListenerUid = user.uid;
              unsubPrefs = listen(
                (next, fail) => onPreferencesChanged(user.uid, next, fail),
                'notifications/onSnapshot',
                (prefs: PreferencesDocument | null) => {
                  if (!prefs) return;
                  useNotificationStore.getState().setPreferences(prefs);

                  // WHY: the restore's fallback half for an already-signed-in cold start; useNoticesTab's sign-in handler is the
                  // other. Never change one alone: both overwrite with identical data. The 'dept' key is a coordinated rename.
                  restoreOnboardingFromPreferences(prefs);
                },
              );
            }

            // WHY: heals the ghost state (a signed-in account with no preferences/main) outside the push gates, which a
            // user who denied or skipped notifications never passes; local onboarding choices seed it.
            if (!user.isAnonymous) {
              const restore = onboardingRestore();
              withRetry(() => ensurePreferencesDoc(user.uid, restore)).catch(
                (err) => logHandledError('notifications/ensure-prefs', err),
              );
            }

            if (bookmarksListenerUid !== user.uid) {
              unsubBookmarks?.();
              bookmarksListenerUid = user.uid;
              unsubBookmarks = listenToBookmarks(user.uid, listen);
            }
          } else {
            if (__DEV__) console.log('[auth] onAuthStateChanged: signed out');
            authStore.getState().setUnauthenticated();
            setAnalyticsUserId(null);
            setAuthState('signed_out');
            unsubPrefs?.();
            unsubPrefs = undefined;
            prefsListenerUid = null;
            useNotificationStore.getState().resetPreferences();
            // WHY: cleared, or the next user on a shared device sees the previous account's bookmarks until the listener attaches.
            unsubBookmarks?.();
            unsubBookmarks = undefined;
            bookmarksListenerUid = null;
            useBookmarkStore.getState().clearEntries();
            // WHY: never reset lastKnownUid here; the next user's prevUid != uid is how the transition is detected.
          }
        });

        await setupNotificationChannels();
        const deviceId = getOrCreateDeviceId();
        useNotificationStore.getState().setDeviceId(deviceId);

        // QUIRK(ios): the APNs token can arrive after a cold start, and FCM rotates tokens, so the device re-registers here.
        unsubToken = onTokenRefresh((token) =>
          registerRefreshedToken(token, toNotificationLocale(resolveAppLanguage(getLocales()))),
        );

        // WHY: not awaited, since the ads SDK can be slow to initialize.
        mobileAds().initialize().then((adapterStatuses) => {
          if (__DEV__) {
            console.log('[AdMob] SDK initialized, adapter statuses:', JSON.stringify(adapterStatuses));
          }
        }).catch(() => {});

        const lang = resolveAppLanguage(getLocales());
        useSettingsStore.getState().setAppLanguage(lang);
        setAppLanguage(lang);
        setPreferredCampus(useSettingsStore.getState().preferredCampus);

        setIsReady(true);
        launchReady = true;
        void retryPendingMiniAppOptIns();
        // WHY: after `setIsReady`, since neither the permission nor the token request has a time bound.
        registerPushAtLaunch(deviceId, toNotificationLocale(lang)).catch((err) =>
          logHandledError('notifications/init', err),
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : translate(resolveAppLanguage(getLocales()), 'error.appStart');
        authStore.getState().setError(message);
        setError(message);
      }
    }

    init();

    return () => {
      unsubscribe?.();
      unsubToken?.();
      unsubPrefs?.();
      unsubBookmarks?.();
    };
  }, []);

  useForegroundSync();

  return { isReady, error };
}
