/**
 * QUIRK(naver-map): any camera move silently downgrades `Follow`/`Face` to `NoFollow`, so `mode` mirrors
 * `onOptionChanged`, not the taps. A pinch zooms about the fingers, so scroll is off for a pinch that starts
 * on a following map (`stepPinchLock`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, type GestureResponderEvent } from 'react-native';
import { getForegroundLocationPermission, requestForegroundLocationPermission } from '@/platform/location';
import type { LocationTrackingMode, NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import { useT } from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { NO_PINCH, stepPinchLock } from '../pinch-lock.rules';
import { markHandoff, openAppSettings } from '@/platform/handoff';

export function isTracking(mode: LocationTrackingMode): boolean {
  return mode !== 'None';
}

export function isFacing(mode: LocationTrackingMode): boolean {
  return mode === 'Face';
}

export function useLocationTracking(mapRef: React.RefObject<NaverMapViewRef | null>) {
  const { t } = useT();

  const [mode, setMode] = useState<LocationTrackingMode>('None');

  /** WHY: the ref sees every touch move without a render; the state changes only when a pinch starts or ends. */
  const pinch = useRef(NO_PINCH);
  const [scrollLocked, setScrollLocked] = useState(false);

  const requesting = useRef(false);

  /**
   * WHY: `null` at first so the standing offer does not flash on cold start; re-checked on foreground, since
   * Settings is the only way back from a permanent denial.
   */
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      getForegroundLocationPermission()
        .then((r) => {
          if (!cancelled) setPermissionGranted(r.granted);
        })
        .catch((e) => logHandledError('useLocationTracking/checkPermission', e));
    };
    check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const handleOptionChanged = useCallback(
    (params: { locationTrackingMode: LocationTrackingMode }) => {
      setMode(params.locationTrackingMode);
    },
    [],
  );

  /**
   * WHY: plain RN touch events: the map's native recognizers cannot cancel them, while a detector would
   * compete with those recognizers.
   */
  const mapTouchHandlers = useMemo(() => {
    const following = mode === 'Follow' || mode === 'Face';
    const onTouch = (e: GestureResponderEvent) => {
      const next = stepPinchLock(pinch.current, e.nativeEvent.touches.length, following);
      if (next === pinch.current) return;
      pinch.current = next;
      setScrollLocked(next.locked);
    };
    return {
      onTouchStart: onTouch,
      onTouchMove: onTouch,
      onTouchEnd: onTouch,
      onTouchCancel: onTouch,
    };
  }, [mode]);

  /**
   * WHY: checks before asking, so a granted user sees no prompt; `canAskAgain` separates undecided from denied
   * for good, and only the latter goes to Settings.
   */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (requesting.current) return false;
    requesting.current = true;
    try {
      const current = await getForegroundLocationPermission();
      setPermissionGranted(current.granted);
      if (current.granted) return true;

      if (current.canAskAgain) {
        markHandoff('permission');
        const asked = await requestForegroundLocationPermission();
        setPermissionGranted(asked.granted);
        // WHY: denied at the prompt just now, so no Settings detour.
        return asked.granted;
      }

      // WHY: `openAppSettings()`, not `openOsSettings`, which sends Android to the notification settings page.
      Alert.alert(t('map.permission.deniedTitle'), t('map.permission.deniedBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('map.permission.openSettings'),
          onPress: () => {
            openAppSettings().catch((e) =>
              logHandledError('useLocationTracking/openSettings', e),
            );
          },
        },
      ]);
      return false;
    } catch (e) {
      logHandledError('useLocationTracking/ensurePermission', e);
      return false;
    } finally {
      requesting.current = false;
    }
  }, [t]);

  /** WHY: facing goes back to `Follow` rather than off, as in the reference; panning is what turns tracking off. */
  const cycleMode = useCallback(async (): Promise<boolean> => {
    const next: LocationTrackingMode = mode === 'Follow' ? 'Face' : 'Follow';

    // WHY: re-checked on every activation: permission can be revoked while backgrounded, and tracking without it
    // shows no dot, which looks like a broken button.
    if (mode !== 'Follow' && mode !== 'Face') {
      const ok = await ensurePermission();
      if (!ok) return false;
    }

    mapRef.current?.setLocationTrackingMode(next);
    // WHY: optimistic, corrected by `onOptionChanged`; waiting on the native round trip reads as a dropped tap.
    setMode(next);
    // WHY: the caller reads the following settle as the answer to "where am I"; a refused permission must not be.
    return true;
  }, [mode, ensurePermission, mapRef]);

  /** WHY: only after a granted check; the SDK is never the one to ask. */
  const showUserLocation = useCallback(() => {
    mapRef.current?.setLocationTrackingMode('NoFollow');
    setMode('NoFollow');
  }, [mapRef]);
  return {
    mode,
    scrollLocked,
    mapTouchHandlers,
    permissionGranted,
    requestPermission: ensurePermission,
    handleOptionChanged,
    cycleMode,
    showUserLocation,
  };
}
