import { useCallback, useEffect, useRef, useState } from 'react';
import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { logHandledError } from '@/platform/crashlytics';
import { markHandoff } from '@/platform/handoff';

export type RewardedStatus = 'loading' | 'ready' | 'failed' | 'off';

/**
 * EVIDENCE: a fresh ad unit answers `googleMobileAds/network-error` now and then, and one miss at mount hid the
 * offer for every later crash.
 */
const RETRY_AFTER_MS = [2_000, 8_000, 30_000];

/** WHY: `show()` resolves true only when the ad reported the reward and then closed; closing early earns nothing. */
export function useRewardedRevive(unitId: string, enabled: boolean) {
  const adRef = useRef<RewardedAd | null>(null);
  const detachRef = useRef<() => void>(() => {});
  const showingRef = useRef(false);
  const mountedRef = useRef(true);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<RewardedStatus>(enabled ? 'loading' : 'off');

  const load = useCallback(
    (firstAttempt = 0) => {
      if (!enabled) return;
      // WHY: the recursion stays in this closure, so a retry runs with the same unit and `enabled` as the load that
      // failed.
      const attemptLoad = (attempt: number) => {
        detachRef.current();
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = null;
        const ad = RewardedAd.createForAdRequest(unitId);
        adRef.current = ad;
        setStatus('loading');
        const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setStatus('ready'));
        const offError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
          const wait = RETRY_AFTER_MS[attempt];
          if (wait !== undefined && mountedRef.current) {
            retryRef.current = setTimeout(() => attemptLoad(attempt + 1), wait);
            return;
          }
          logHandledError('games/rewarded-load', error);
          setStatus('failed');
        });
        detachRef.current = () => {
          offLoaded();
          offError();
        };
        ad.load();
      };
      attemptLoad(firstAttempt);
    },
    [unitId, enabled],
  );

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      detachRef.current();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [load]);

  const show = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const ad = adRef.current;
        if (!ad || status !== 'ready' || showingRef.current) {
          resolve(false);
          return;
        }
        showingRef.current = true;
        detachRef.current();
        let earned = false;
        const offs: (() => void)[] = [];
        const finish = (ok: boolean) => {
          offs.forEach((off) => off());
          showingRef.current = false;
          resolve(ok);
          if (mountedRef.current) load();
        };
        detachRef.current = () => offs.forEach((off) => off());
        offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => (earned = true)));
        offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)));
        offs.push(
          ad.addAdEventListener(AdEventType.ERROR, (error) => {
            logHandledError('games/rewarded-show', error);
            finish(false);
          }),
        );
        markHandoff('ad');
        ad.show().catch((error) => {
          logHandledError('games/rewarded-show', error);
          finish(false);
        });
      }),
    [status, load],
  );

  const reload = useCallback(() => load(), [load]);
  return { status, show, reload };
}
