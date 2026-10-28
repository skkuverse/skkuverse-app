import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signInAnonymously,
  signOut,
  updateProfile,
  reload,
} from '@react-native-firebase/auth';
import type { User, UserCredential } from '@react-native-firebase/auth';
import {
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  authStore,
  useNotificationStore,
  useSettingsStore,
  withRetry,
} from '@skkuverse/shared';
import { getOrCreateDeviceId } from '@/platform/device-id';
import { ensurePreferencesDoc, getPreferences } from '@/features/notifications/notifications.service';
import { initializeFirestoreNotifications, unregisterDevice } from '@/features/notifications/device/device.service';
import { authFaultFor } from '@/dev/auth-faults/auth-faults.service';
import { isFirstLaunch, track } from '@/platform/analytics';
import { probeAppCheck } from '@/platform/app-check';
import type { AppCheckProbe } from '@/platform/app-check.rules';
import { logHandledError } from '@/platform/crashlytics';
import { createAnonymousSession, probeStopsSignIn } from './anon-session.rules';
import {
  GoogleAuthError,
  appCheckSignInCode,
  classifyAnonFailure,
  classifySignInError,
  sessionReasonMessageKey,
  shouldSignInInsteadOfLink,
  signInErrorMessageKey as signInErrorMessageKeyOn,
  type AnonFailureClass,
  type GoogleSignInErrorCode,
} from './sign-in-errors.rules';
import { NO_PRE_UNREGISTER, startPreUnregister } from './pre-unregister.rules';
import type {
  AuthFlowScope,
  DeleteAccountFeedback,
  DeleteAccountResponse,
  OnboardingClassification,
  SessionRequirement,
} from './auth.types';
import { GOOGLE_WEB_CLIENT_ID } from '../../../config/constants';
import { markHandoff } from '@/platform/handoff';

// WHY: one Crashlytics row per class per process, so a device stuck behind an exhausted quota does
// not log one per retry.
const reportedAnonClasses = new Set<AnonFailureClass>();

export const anonymousSession = createAnonymousSession({
  hasUser: () => getAuth().currentUser !== null,
  signIn: () => {
    const fault = authFaultFor('signIn');
    if (fault) throw fault;
    return signInAnonymously(getAuth());
  },
  probe: () => probeAppCheck('spaced'),
  classify: classifyAnonFailure,
  onAttempt: (report) => {
    track('anon_signin', {
      trigger: report.trigger,
      result: report.result,
      ac_kind: report.acKind,
      code: report.code,
      attempt: report.attempt,
      ms: report.ms,
      first_launch: isFirstLaunch(),
    });
    if (report.result === 'ok' || reportedAnonClasses.has(report.result)) return;
    reportedAnonClasses.add(report.result);
    const error = report.error ?? new Error(`App Check probe ${report.acKind ?? 'failed'}${report.code ? ` ${report.code}` : ''}`);
    logHandledError(`auth/anon-signin/${report.result}`, error);
  },
  // WHY: on a cold start this is splash time; the attempt keeps running past it.
  timeoutMs: 8_000,
  now: Date.now,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  random: Math.random,
});

const ALLOWED_DOMAIN = '@g.skku.edu';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    // EVIDENCE: Metro inlines EXPO_PUBLIC_* at bundle time, and an OTA without the variable gave Android
    // idToken=null (12500). A committed constant cannot be absent; config/constants.js says why it is public.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    hostedDomain: 'g.skku.edu',
  });
}

export { GoogleAuthError, signInErrorAppCheck, signInErrorClass, signInErrorCode } from './sign-in-errors.rules';
export type { GoogleSignInErrorCode } from './sign-in-errors.rules';
export type { SessionReason } from './anon-session.rules';

const DEVICE_OS = Platform.OS === 'android' ? 'android' : 'ios';

export function signInErrorMessageKey(code: GoogleSignInErrorCode) {
  return signInErrorMessageKeyOn(code, DEVICE_OS);
}

/** WHY: for a tap only, never an effect: asking retries at once, and an effect would retry every render. */
export function requireSession(): SessionRequirement {
  const uid = getAuth().currentUser?.uid;
  if (uid) return { uid };
  const reason = anonymousSession.retryNow();
  return { reason, messageKey: sessionReasonMessageKey(reason, DEVICE_OS) };
}

// QUIRK(firebase): linkWithCredential copies only `email` from Google onto the user record, not
// displayName or photoURL; updateProfile + reload persists them for every later onAuthStateChanged.
async function applyProfileUpdate(
  user: User,
  next: { displayName: string | null | undefined; photoURL: string | null | undefined },
): Promise<void> {
  const update: { displayName?: string; photoURL?: string } = {};
  if (!user.displayName && next.displayName) update.displayName = next.displayName;
  if (!user.photoURL && next.photoURL) update.photoURL = next.photoURL;
  if (Object.keys(update).length === 0) return;

  try {
    await updateProfile(user, update);
    await reload(user);
  } catch (err) {
    // WHY: a failed self-heal must not block sign-in; the next session retries.
    logHandledError('auth/sync-profile', err);
  }
}

export async function syncProfileFromGoogleSignin(
  user: User,
  googleProfile: { name: string | null | undefined; photo: string | null | undefined },
): Promise<void> {
  if (user.isAnonymous) return;
  await applyProfileUpdate(user, {
    displayName: googleProfile.name,
    photoURL: googleProfile.photo,
  });
}

export async function syncProfileFromProviderData(
  user: User,
  providerId: string = 'google.com',
): Promise<void> {
  if (user.isAnonymous) return;
  const provider = user.providerData.find((p) => p.providerId === providerId);
  if (!provider) return;
  await applyProfileUpdate(user, {
    displayName: provider.displayName,
    photoURL: provider.photoURL,
  });
}

/**
 * WHY: `beforeAccountSwitch` is awaited before any sign-in that changes the uid: Firestore queues
 * pending writes per uid, so the old user's must land first.
 */
export async function signInWithGoogle(
  opts: { beforeAccountSwitch?: () => Promise<void> } = {},
) {
  // WHY: probed before the sheet and read after it, so the student never waits on it; `immediate`,
  // so a failure within the interval stands. SEE: docs/explanation/app-check.md ("Start-up order")
  const probing = probeAppCheck('immediate');
  let probe: AppCheckProbe | null = null;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    markHandoff('sign_in');
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new GoogleAuthError('CANCELLED');
    }

    const { idToken, user: googleProfile } = response.data;

    if (!idToken) {
      throw new GoogleAuthError('UNKNOWN');
    }

    if (!googleProfile.email.endsWith(ALLOWED_DOMAIN)) {
      // WHY: a failed revoke must not turn "SKKU accounts only" into "try again", which the student
      // would retry forever; signing out at least keeps the account from returning without the chooser.
      await GoogleSignin.revokeAccess().catch(() => GoogleSignin.signOut().catch(() => {}));
      throw new GoogleAuthError('DOMAIN_NOT_ALLOWED');
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);

    probe = await probing;
    if (!probe.ok && probe.kind === 'bounded') probe = await probeAppCheck('immediate');
    if (!probe.ok && probeStopsSignIn(probe.kind)) {
      throw new GoogleAuthError(appCheckSignInCode(probe.kind), {
        kind: probe.kind,
        ...(probe.code !== undefined && { code: probe.code }),
      });
    }
    const fault = authFaultFor('signInWithGoogle');
    if (fault) throw fault;

    const currentUser = getAuth().currentUser;
    let result: UserCredential;

    if (currentUser?.isAnonymous) {
      try {
        result = await linkWithCredential(currentUser, googleCredential);
      } catch (linkErr) {
        // WHY: mostly a returning student whose Google identity has an account, an expected outcome. The
        // anonymous uid's prefs stay orphaned; phase C writes the device doc under the new uid. Anything
        // else, offline above all, is thrown (shouldSignInInsteadOfLink).
        if (!shouldSignInInsteadOfLink(linkErr)) throw linkErr;
        await opts.beforeAccountSwitch?.();
        result = await signInWithCredential(getAuth(), googleCredential);
      }
    } else {
      // WHY: switching Google accounts changes the uid too; with nobody signed in nothing is queued.
      if (currentUser) await opts.beforeAccountSwitch?.();
      result = await signInWithCredential(getAuth(), googleCredential);
    }

    await syncProfileFromGoogleSignin(result.user, {
      name: googleProfile.name,
      photo: googleProfile.photo,
    });

    return result;
  } catch (err) {
    // WHY: the probe already reported its own failure as `app-check/probe`, so a sign-in it skipped
    // is not a second row.
    const { code, report, appCheck } = classifySignInError(err, statusCodes, probe);
    if (report) logHandledError('google-auth/signin-unexpected', err);
    throw new GoogleAuthError(code, appCheck);
  }
}

export async function signOutFromGoogle() {
  authStore.getState().setSigningOut(true);
  try {
    // WHY: unregistered before signing out, while this user can still write the doc, so it is not left
    // active and tied to this uid once the next account on this device registers.
    try {
      const deviceId = getOrCreateDeviceId();
      await unregisterDevice(deviceId);
    } catch (err) {
      // WHY: never blocks sign-out; the next auth transition re-runs the migration.
      logHandledError('notifications/pre-signout-unregister', err);
    }

    await GoogleSignin.signOut();
    await signOut(getAuth());

    // WHY: through the session, never signInAnonymously directly, so a foreground retry cannot race
    // this into a second anonymous account.
    await anonymousSession.ensure('signout');
  } finally {
    authStore.getState().setSigningOut(false);
  }
}

// WHY: counted from the sheet closing, after the write has had the student's whole time in the sheet,
// so it runs out only on a connection too slow to write at all.
const PRE_UNREGISTER_SETTLE_MS = 4_000;

/**
 * WHY: unregisterDevice, then sign in, then await initializeFirestoreNotifications. Phases A and C log
 * under `${scope}/…` and swallow, and a thrown GoogleAuthError is already reported, so a caller logs none.
 * SEE: docs/explanation/fcm-architecture.md ("Auth transitions between an anonymous and a Google uid")
 */
export async function signInWithDeviceMigration(
  scope: AuthFlowScope,
): Promise<User> {
  const deviceId = useNotificationStore.getState().deviceId;
  // QUIRK(firebase): signInAnonymously resolving after the Google credential replaces the Google user,
  // so the retry is held and an issued attempt lands first. Pauses nest; resume() is in the finally.
  await anonymousSession.pause();
  let result: UserCredential;
  let preUnregister = NO_PRE_UNREGISTER;
  try {
    // WHY: phase A is skipped only when every persisted signal is at its install default: an APNs
    // timeout stores a null token over a good one while the doc lives on, still tied to the old uid.
    const { fcmToken, isTokenRegistered, permissionStatus } =
      useNotificationStore.getState();
    const mayHaveDoc =
      fcmToken !== null || isTokenRegistered || permissionStatus !== 'notDetermined';
    // WHY: phase A writes as the signed-in owner, so with the anonymous sign-in failed it has nothing to do.
    const signedIn = getAuth().currentUser !== null;
    preUnregister =
      deviceId && mayHaveDoc && signedIn
        ? startPreUnregister({
            run: (signal, onIssued) =>
              unregisterDevice(deviceId, signal, onIssued).catch((err) => {
                logHandledError(`${scope}/pre-unregister-anon-device`, err);
              }),
            timeoutMs: PRE_UNREGISTER_SETTLE_MS,
            // WHY: the uid is about to change with the write unsent, which can leave the device doc active
            // and tied to the old uid.
            onLandTimeout: () =>
              logHandledError(`${scope}/pre-unregister-timeout`, new Error('phase A did not land')),
          })
        : NO_PRE_UNREGISTER;

    result = await signInWithGoogle({ beforeAccountSwitch: preUnregister.landed });
    // WHY: a link keeps the uid, so the write only has to be queued ahead of phase C's.
    await preUnregister.issued();
  } finally {
    // WHY: on a failure a write still waiting on App Check is dropped, so the device stays registered
    // under the anonymous user it still belongs to.
    preUnregister.abort();
    anonymousSession.resume();
  }
  const user = result.user;
  // QUIRK(firebase): Android's linkWithCredential keeps the uid and fires no onAuthStateChanged.
  authStore.getState().setAuthenticated({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  });

  // WHY: Android's link fires no onAuthStateChanged, so useAppInit's self-heal never runs for it. Kept
  // outside the fcmToken gate, null during first onboarding, and not awaited, so it never stalls sign-in.
  withRetry(() => ensurePreferencesDoc(user.uid)).catch((err) => {
    logHandledError(`${scope}/ensure-prefs`, err);
  });

  const fcmToken = useNotificationStore.getState().fcmToken;
  if (deviceId && fcmToken) {
    const lang = useSettingsStore.getState().appLanguage;
    try {
      await initializeFirestoreNotifications({
        uid: user.uid,
        deviceId,
        token: fcmToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: Constants.expoConfig?.version ?? '0.0.0',
        osLocale: lang === 'ko' ? 'ko' : 'en',
      });
    } catch (err) {
      logHandledError(`${scope}/post-signin-register`, err);
    }
  }

  return user;
}

/**
 * WHY: never throws. On `restored` it flips `onboardingCompleted` in the same frame, closing the race
 * with useAppInit's onPreferencesChanged. `onboardedAt` alone decides; the `dept` list may be empty.
 */
export async function classifyAndRestoreOnboarding(
  uid: string,
  scope: AuthFlowScope,
): Promise<OnboardingClassification> {
  let prefs;
  try {
    prefs = await getPreferences(uid);
  } catch (err) {
    logHandledError(`${scope}/prefs-read`, err);
    return { kind: 'read-failed' };
  }

  if (prefs?.onboardedAt != null) {
    const restoredDeptIds = prefs?.pickerSelections?.dept ?? [];
    // WHY: '' is the sentinel for a skipped primary department.
    const restoredPrimary = restoredDeptIds[0] || null;
    const restoredInterests = restoredDeptIds.slice(1, 5);
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: restoredPrimary,
      interestDeptIds: restoredInterests,
    });
    return { kind: 'restored' };
  }

  return { kind: 'new' };
}

const REGION = 'asia-northeast3';

export async function deleteAccount(
  feedback?: DeleteAccountFeedback,
): Promise<void> {
  authStore.getState().setSigningOut(true);
  try {
    const fns = getFunctions(getApp(), REGION);
    const callable = httpsCallable<
      { feedback?: DeleteAccountFeedback },
      DeleteAccountResponse
    >(fns, 'deleteAccount');
    await callable({ feedback });

    // WHY: cleared before the sign-out, so the uid transition it causes has nothing to re-apply to the
    // new anonymous uid.
    useSettingsStore.getState().clearMiniAppOptIns();

    // QUIRK(google-signin): revoking needs an active Google session, so it runs before signOut.
    try {
      await GoogleSignin.revokeAccess();
    } catch (err) {
      logHandledError('delete-account/revoke-access', err);
    }

    try {
      await GoogleSignin.signOut();
    } catch (err) {
      logHandledError('delete-account/google-signout', err);
    }

    try {
      await signOut(getAuth());
    } catch (err) {
      logHandledError('delete-account/firebase-signout', err);
    }

    await anonymousSession.ensure('delete');

    useSettingsStore.getState().resetUserScopedState();
  } finally {
    authStore.getState().setSigningOut(false);
  }
}
