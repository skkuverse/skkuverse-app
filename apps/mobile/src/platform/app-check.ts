import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { authFaultFor } from '@/dev/auth-faults/auth-faults.service';
import { isFirstLaunch, track } from './analytics';
import type { AppCheckProvider } from './analytics.types';
import {
  classifyAppCheckError,
  createAppCheckProbe,
  INITIAL_REFRESH_CLOCK,
  observeToken,
  PROBE_MIN_INTERVAL_MS,
  PROBE_TIMEOUT_MS,
  shouldForceRefresh,
  shouldReportAppCheckFailure,
  type AppCheckProbe,
  type ProbeMode,
  type RefreshClock,
} from './app-check.rules';
import { logHandledError } from './crashlytics';

/** QUIRK(react-native-firebase): the modular API has no getter for the instance `initializeAppCheck` returns. */
let instance: AppCheck | null = null;

export function getAppCheckInstance(): AppCheck | null {
  return instance;
}

const PROVIDER: AppCheckProvider = __DEV__
  ? 'debug'
  : Platform.OS === 'android'
    ? 'playIntegrity'
    : 'appAttestWithDeviceCheckFallback';

function launchParams() {
  return { provider: PROVIDER, first_launch: isFirstLaunch() };
}

export async function setupAppCheck(): Promise<void> {
  const provider = new ReactNativeFirebaseAppCheckProvider();

  // SEE: docs/explanation/app-check.md ("Getting a debug token into the iOS simulator"): only
  // `configure({ debugToken })` reliably picks the token; the UserDefaults fallback is ignored there.
  const extra = Constants.expoConfig?.extra ?? {};
  const debugTokenIos = extra.firebaseAppCheckDebugTokenIos as string | undefined;
  const debugTokenAndroid = extra.firebaseAppCheckDebugTokenAndroid as string | undefined;

  provider.configure({
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      ...(__DEV__ && debugTokenAndroid ? { debugToken: debugTokenAndroid } : {}),
    },
    apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      ...(__DEV__ && debugTokenIos ? { debugToken: debugTokenIos } : {}),
    },
  });

  // QUIRK(react-native-firebase): this returns before the native provider is configured, so the probe
  // before sign-in is what waits for it; the first request below is only counted, as every cold start's
  // denominator.
  const appCheck = initializeAppCheck(getApp(), {
    provider,
    isTokenAutoRefreshEnabled: true,
  });
  instance = appCheck;

  const startedAt = Date.now();
  getToken(appCheck, false).then(
    () => track('app_check', { phase: 'init', result: 'ok', ms: Date.now() - startedAt, ...launchParams() }),
    (e: unknown) => reportFailure('init', e, Date.now() - startedAt),
  );
}

type AppCheckPhase = 'init' | 'refresh' | 'probe';

function reportFailure(phase: AppCheckPhase, error: unknown, ms: number): void {
  const { kind, code } = classifyAppCheckError(error);
  track('app_check', { phase, result: kind, ms, code, ...launchParams() });
  if (shouldReportAppCheckFailure(kind)) logHandledError(`app-check/${phase}`, error);
}

/**
 * QUIRK(firebase): under Auth enforcement a refused token surfaces as a generic auth error, so an Auth
 * call reads this probe instead. SEE: docs/explanation/app-check.md ("Start-up order")
 */
const probe = createAppCheckProbe({
  getToken: () => {
    const fault = authFaultFor('probe');
    if (fault) return Promise.reject(fault);
    const appCheck = getAppCheckInstance();
    if (!appCheck) return Promise.reject(new Error('App Check is not initialized'));
    return getToken(appCheck, false);
  },
  now: Date.now,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  timeoutMs: PROBE_TIMEOUT_MS,
  minIntervalMs: PROBE_MIN_INTERVAL_MS,
  onOutcome: (outcome, error) => {
    if (outcome.ok) {
      track('app_check', { phase: 'probe', result: 'ok', ms: outcome.ms, ...launchParams() });
      return;
    }
    track('app_check', { phase: 'probe', result: outcome.kind, ms: outcome.ms, code: outcome.code, ...launchParams() });
    if (outcome.kind !== 'bounded' && shouldReportAppCheckFailure(outcome.kind)) logHandledError('app-check/probe', error);
  },
});

export function probeAppCheck(mode: ProbeMode): Promise<AppCheckProbe> {
  return probe(mode);
}

/**
 * WHY: one clock for every Firestore write path, so the attestation quota is counted once; never copy it.
 * SEE: docs/explanation/app-check.md ("Play Integrity throttling (-8) and `primeAppCheck`")
 */
let refreshClock: RefreshClock = INITIAL_REFRESH_CLOCK;

export async function primeAppCheck(): Promise<void> {
  const appCheck = getAppCheckInstance();
  if (!appCheck) return;
  const startedAt = Date.now();
  try {
    const held = await getToken(appCheck, false);
    refreshClock = observeToken(refreshClock, held.token, Date.now(), false);
    if (!shouldForceRefresh(refreshClock, Date.now())) return;
    const fresh = await getToken(appCheck, true);
    refreshClock = observeToken(refreshClock, fresh.token, Date.now(), true);
  } catch (e) {
    reportFailure('refresh', e, Date.now() - startedAt);
  }
}
