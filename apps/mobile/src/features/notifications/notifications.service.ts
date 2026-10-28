import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import {
  authStore,
  useSettingsStore,
  withRetry,
  type PreferencesDocument,
  type UserDocument,
} from '@skkuverse/shared';
import type { SessionRequirement } from '@/features/auth/auth.types';
import { writeWithSelfHeal } from './prefs-self-heal.rules';
import {
  createKeyedSingleFlight,
  enabledAfterOnboardingDecline,
  miniAppSubscriptionMutation,
} from './miniapp-push.rules';
import { primeAppCheck } from '@/platform/app-check';
import { track } from '@/platform/analytics';
import type { EventMap } from '@/platform/analytics.types';
import { logBreadcrumb, logHandledError } from '@/platform/crashlytics';
import { isMissingPrefsDocError } from './prefs-write-errors.rules';

/**
 * WHY: the client writes intent only, never `subscribedTopics` or `derivedAt`, each write one dot-path
 * `updateDoc` with no transaction, since a transaction fails at once offline (campus Wi-Fi dead spots).
 * SEE: docs/explanation/fcm-architecture.md ("The principle: what is recorded is intent, what is sent is derived")
 */

const USERS = 'users';
const PREFERENCES = 'preferences';
const PREFERENCES_DOC_ID = 'main';

// WHY: auth's `requireSession` also retries a lost anonymous sign-in, and auth.service imports this
// file, so bootstrap registers it here at load (ADR 0020 D2). Until then a signed-in store answers.
let sessionGate: () => SessionRequirement = () => {
  const uid = authStore.getState().uid;
  return uid ? { uid } : { reason: 'connecting', messageKey: 'auth.sessionConnecting' };
};

export function registerSessionGate(gate: () => SessionRequirement): void {
  sessionGate = gate;
}

/** WHY: call it from a tap, never an effect. */
export function requireNotificationSession(): SessionRequirement {
  return sessionGate();
}

function prefsRef(uid: string) {
  return doc(getFirestore(), USERS, uid, PREFERENCES, PREFERENCES_DOC_ID);
}

export async function getUserDoc(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(getFirestore(), USERS, uid));
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

export async function getPreferences(
  uid: string,
): Promise<PreferencesDocument | null> {
  const snap = await getDoc(prefsRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as PreferencesDocument;
}

export async function updateUserLocale(
  uid: string,
  locale: 'ko' | 'en',
): Promise<void> {
  await primeAppCheck();
  await setDoc(doc(getFirestore(), USERS, uid), { locale } satisfies UserDocument, { merge: true });
}

export function syncUserLocale(locale: UserDocument['locale']): void {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  void updateUserLocale(uid, locale).catch((err) => {
    logHandledError('notifications/locale-sync', err);
  });
}

/**
 * WHY: `update()` cannot create a missing document (the ghost state), so every writer shares one recovery.
 * `restore` seeds the user's MMKV selection: a seed with a null `onboardedAt` is permanent, since
 * `ensurePreferencesDoc` returns early on an existing document.
 */
async function updatePrefsWithSelfHeal(
  uid: string,
  mutation: Record<string, unknown>,
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<void> {
  await primeAppCheck();
  await writeWithSelfHeal({
    write: () => updateDoc(prefsRef(uid), mutation),
    ensure: () => ensurePreferencesDoc(uid, restore),
    isRecoverable: isMissingPrefsDocError,
    onEnsureError: (err) => logHandledError('notifications/self-heal-seed', err),
  });
}

export async function setMasterEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updatePrefsWithSelfHeal(uid, { enabled });
}

export async function setCategoryEnabled(
  uid: string,
  key: 'essential' | 'services' | 'notices',
  on: boolean,
): Promise<void> {
  await updatePrefsWithSelfHeal(uid, { [`categoryEnabled.${key}`]: on });
}

/** WHY: meaningful only under `categoryEnabled.notices`; the derive returns nothing while it is off. */
export async function setNoticeTabEnabled(
  uid: string,
  tabKey: string,
  on: boolean,
): Promise<void> {
  await updatePrefsWithSelfHeal(uid, { [`noticeTabEnabled.${tabKey}`]: on });
}

export async function setPickerSelectionRemote(
  uid: string,
  tabKey: string,
  ids: string[],
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<void> {
  await updatePrefsWithSelfHeal(
    uid,
    { [`pickerSelections.${tabKey}`]: ids },
    restore,
  );
}

/**
 * WHY: arrayUnion/arrayRemove, one atomic field mutation Firestore queues offline, so two devices toggling
 * different mini apps cannot clobber each other. Self-heals, since an anonymous or never-onboarded
 * subscriber may have no document.
 */
export async function setMiniAppSubscribed(
  uid: string,
  miniAppId: string,
  on: boolean,
): Promise<void> {
  await primeAppCheck();
  const mutation = miniAppSubscriptionMutation(miniAppId, on, { arrayUnion, arrayRemove });

  await updatePrefsWithSelfHeal(uid, mutation);
}

/**
 * WHY: a `set()` over an existing document rewrites the derived `subscribedTopics`, so a missing one gets
 * the full seed and an existing one a dot-path update of the changed fields. The wizard seeds with a null
 * `onboardedAt` and finalizes later; the decline seeds and finalizes in one call.
 */
export async function seedOnboardingPreferences(
  uid: string,
  pickerSelections: Record<string, string[]>,
  opts: { enabled?: boolean; finalize?: boolean } = { enabled: true, finalize: true },
): Promise<void> {
  const enabled = opts.enabled ?? true;
  const finalize = opts.finalize ?? true;
  await primeAppCheck();

  const existing = await getPreferences(uid);

  // WHY: (C2) the decline is of notices; a mini-app opt-in keeps the master switch on, or the derive emits nothing for it.
  const masterEnabled =
    enabled ||
    enabledAfterOnboardingDecline({
      miniAppSelections: existing?.miniAppSelections,
      optIns: useSettingsStore.getState().miniAppOptIns,
    });

  if (!existing) {
    const seed: PreferencesDocument = {
      enabled: masterEnabled,
      // WHY: `essential` is always seeded on; `notices: enabled` records a decline as an explicit false.
      categoryEnabled: { essential: true, services: false, notices: enabled },
      // WHY: an empty record means every notice tab is on, by the derive's contract.
      noticeTabEnabled: {},
      pickerSelections,
      subscribedTopics: [],
      derivedAt: null,
      onboardedAt: finalize
        ? (serverTimestamp() as unknown)
        : null,
    };
    await setDoc(prefsRef(uid), seed);
    return;
  }

  // WHY: dot-path updates only, so the derived fields stay untouched. `noticeTabEnabled: {}` deletes every
  // sub-key, since re-entering the wizard is a fresh seed and a leftover OFF would show as OFF.
  const updates: Record<string, unknown> = {
    enabled: masterEnabled,
    'categoryEnabled.notices': enabled,
    noticeTabEnabled: {},
  };
  for (const [tabKey, ids] of Object.entries(pickerSelections)) {
    updates[`pickerSelections.${tabKey}`] = ids;
  }
  // WHY: `onboardedAt` goes one way, null to a timestamp.
  if (finalize && existing.onboardedAt == null) {
    updates.onboardedAt = serverTimestamp();
  }
  await updateDoc(prefsRef(uid), updates);
}

/**
 * WHY: idempotent, since the completion gate waits for it: an existing timestamp succeeds with no write
 * (re-onboarding after a local wipe), and a missing document gets a full seed from `pickerSelections`.
 */
export async function finalizeOnboardingAccepted(
  uid: string,
  pickerSelections: Record<string, string[]>,
): Promise<void> {
  const existing = await getPreferences(uid);
  if (existing?.onboardedAt != null) return;
  if (!existing) {
    await seedOnboardingPreferences(uid, pickerSelections, {
      enabled: true,
      finalize: true,
    });
    return;
  }
  await primeAppCheck();
  await updateDoc(prefsRef(uid), {
    onboardedAt: serverTimestamp(),
  });
}

/** QUIRK(firebase): the listener ends on its first error; `onError` replaces the default log. */
export function onPreferencesChanged(
  uid: string,
  callback: (prefs: PreferencesDocument | null) => void,
  onError: (err: unknown) => void = (err) => logHandledError('notifications/onSnapshot', err),
): () => void {
  return onSnapshot(
    prefsRef(uid),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as PreferencesDocument);
    },
    onError,
  );
}

const DEFAULT_PREFS: PreferencesDocument = {
  enabled: false,
  // WHY: `essential` is never seeded off.
  categoryEnabled: { essential: true, services: false, notices: false },
  noticeTabEnabled: {},
  pickerSelections: {},
  subscribedTopics: [],
  derivedAt: null,
  onboardedAt: null,
};

/**
 * WHY: runs whatever the FCM token or permission, since a missing document silently kills every patch
 * write, for a user who refused notifications too. `restore` seeds the MMKV onboarding history with
 * `onboardedAt` set, so the listener's auto-restore works after.
 */
/** WHY: (C3) one seed per uid at a time, or a second full `set()` wipes the first caller's follow-up write. */
const ensureFlight = createKeyedSingleFlight<PreferencesDocument>();

export function ensurePreferencesDoc(
  uid: string,
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<PreferencesDocument> {
  return ensureFlight(uid, () => ensurePreferencesDocOnce(uid, restore));
}

async function ensurePreferencesDocOnce(
  uid: string,
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<PreferencesDocument> {
  const existing = await getPreferences(uid);
  if (existing) return existing;

  const seed: PreferencesDocument = {
    ...DEFAULT_PREFS,
    ...(restore
      ? {
          pickerSelections: restore.pickerSelections,
          onboardedAt: restore.onboarded
            ? (serverTimestamp() as unknown)
            : null,
        }
      : {}),
  };
  await primeAppCheck();
  await setDoc(prefsRef(uid), seed);
  return seed;
}

/** WHY: the uid is read per attempt, so a retry landing after a uid transition writes the current uid. */
export function retryForCurrentUid(write: (uid: string) => Promise<void>): Promise<void> {
  return withRetry(() => {
    const currentUid = getAuth().currentUser?.uid;
    if (!currentUid) {
      throw new Error('no authenticated user');
    }
    return write(currentUid);
  });
}

/**
 * WHY: GA4 `push_sub` counts outcomes in Realtime during a festival, and the Crashlytics breadcrumb gives a
 * later crash the subscription history. Never throws: logging must not break a subscription.
 */
export function logPushSub(params: EventMap['push_sub']): void {
  try {
    track('push_sub', params);
  } catch {
    // WHY: logging never throws.
  }
  const line = `[push_sub] ${params.miniapp_id} ${params.op} ${params.source} ${params.result}${
    params.error ? ` ${params.error}` : ''
  }`;
  if (__DEV__) {
    console.log(line);
    return;
  }
  logBreadcrumb(line);
}

export function errorCode(err: unknown): string {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === 'string' && code) return code.slice(0, 60);
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 60);
}
