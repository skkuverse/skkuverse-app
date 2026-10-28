import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import {
  SdsSpacing,
  useAuthStore,
  useLaunchStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { useAppInit } from '@/bootstrap/useAppInit';
import { useOTAUpdate } from '@/bootstrap/useOTAUpdate';
import { openExternalUrl } from '@/platform/handoff';
import { reload } from '@/platform/ota';
import { cachedUpdateUrl, checkForceUpdate } from './app-config.client';
import { IntroScreen } from '@/features/tour/IntroScreen';
import { SKKUverseSplash } from './SKKUverseSplash';
import { ScreenViewTracker } from './ScreenViewTracker';
import { ForceUpdateScreen } from './ForceUpdateScreen';
import { ResultSection, Txt, createThemedStyles } from '@skkuverse/sds';

const OTA_TIMEOUT_MS = 10_000;
const BACKGROUND_THRESHOLD_MS = 5 * 60 * 1000;

type Phase = 'ota' | 'init' | 'forceUpdate' | 'ready' | 'error';

export function InitGate({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const { isReady, error } = useAppInit();
  const { t } = useT();
  const ota = useOTAUpdate();

  const [phase, setPhase] = useState<Phase>('ota');
  // WHY: adjusted during render, not in an effect, so the error screen is the very next paint.
  if (phase === 'init' && error) setPhase('error');
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    useLaunchStore.getState().setSplashUp(showSplash);
  }, [showSplash]);
  const [forceUpdateUrl, setForceUpdateUrl] = useState<string | null>(null);
  const backgroundAt = useRef<number>(0);
  const otaDone = useRef(false);
  const isChecking = useRef(false);

  const authInitialized = useAuthStore((s) => s.isInitialized);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const seenIntro = useSettingsStore((s) => s.seen.intro === true);
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    if (otaDone.current) return;
    otaDone.current = true;

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      setPhase('init');
    }, OTA_TIMEOUT_MS);

    (async () => {
      const hasUpdate = await ota.checkAndDownload();

      if (timedOut) return;
      clearTimeout(timeout);

      if (hasUpdate) {
        await ota.applyUpdate();
      }

      setPhase('init');
    })();

    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the launch sequence runs once, on mount

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundAt.current = Date.now();
      }

      if (state === 'active' && backgroundAt.current > 0) {
        const elapsed = Date.now() - backgroundAt.current;
        backgroundAt.current = 0;
        const longBackground = elapsed >= BACKGROUND_THRESHOLD_MS;

        (async () => {
          const hasUpdate = await ota.checkAndDownload();
          if (!hasUpdate) return;

          if (longBackground) {
            setShowSplash(true);
            setPhase('ota');
            await ota.applyUpdate();
          }
        })();
      }
    });

    return () => sub.remove();
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps -- one AppState listener per readiness change; it reads refs, not render values

  useEffect(() => {
    if (phase !== 'init') return;
    if (error) return;
    if (!isReady || isChecking.current) return;

    isChecking.current = true;
    (async () => {
      const { required, updateUrl } = await checkForceUpdate();
      if (required) {
        setForceUpdateUrl(updateUrl);
        setPhase('forceUpdate');
      } else {
        setPhase('ready');
      }
    })();
  }, [phase, isReady, error]);

  // WHY: waits on `authInitialized`, since `isAnonymous` defaults true until Firebase answers after isReady.
  // WHY: decided once and frozen, so signing in on the intro's last page cannot unmount it mid-flow.
  if (showIntro === null && phase === 'ready' && authInitialized) {
    setShowIntro(isAnonymous && !seenIntro);
  }

  if (phase === 'forceUpdate') {
    return <ForceUpdateScreen updateUrl={forceUpdateUrl} />;
  }

  if (phase === 'error') {
    // QUIRK(hot-updater): it rolls back only on a crash before first content, so a JS restart from here is safe.
    const updateUrl = cachedUpdateUrl();
    return (
      <View style={styles.container}>
        <ResultSection
          title={t('error.appStart')}
          description={t('error.tryLater')}
          primaryActionProps={{ children: t('common.retry'), onPress: () => void reload() }}
          secondaryActionProps={
            updateUrl ? { children: t('update.goToStore'), onPress: () => void openExternalUrl(updateUrl) } : undefined
          }
          style={styles.result}
        />

        {__DEV__ && error && (
          <Txt typography="t3" color="critical" textAlign="center" style={styles.debug}>
            {error}
          </Txt>
        )}
      </View>
    );
  }

  // WHY: the intro replaces children, so no screen_view or query fires for a tab nobody has seen; a stashed
  // cold-start deep link is drained when the tree mounts after it.
  return (
    <>
      <ScreenViewTracker
        ready={phase === 'ready' && authInitialized && showIntro !== null}
        overlay={showIntro ? 'intro' : null}
      />
      {showIntro ? (
        <IntroScreen
          onDone={() => {
            useSettingsStore.getState().markSeen('intro');
            setShowIntro(false);
          }}
        />
      ) : (
        children
      )}
      {/* WHY: after the intro and `children`, so the splash layers above both and hands off with no white flash. */}
      {showSplash && (
        <SKKUverseSplash
          isReady={phase === 'ready'}
          onDismiss={() => setShowSplash(false)}
        />
      )}
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color.bg.neutralMuted,
    padding: SdsSpacing.x6,
  },
  // WHY: its own height rather than RESULT-01's fill, so the debug line sits right under it.
  result: {
    flexGrow: 0,
  },
  debug: {
    marginTop: SdsSpacing.x4,
  },
}));
