/** WHY: mounts with the host, so a return from the background asks nothing (ADR 0022 d1). */

import { useEffect, useMemo, useState } from 'react';
import { logHandledError } from '@/platform/crashlytics';
import { getFixWithoutPrompt } from '@/platform/location';
import { decideLaunchCamera, launchNearbyOf, type LaunchCamera } from './launch-camera.rules';
import type { CampusDef } from './map-config.types';
import type { MapPlace } from './overlay.types';
import type { LatLng } from '@skkuverse/shared';
import { LAUNCH_FIX_TIMEOUT_MS, LAUNCH_PLACES_WAIT_MS } from './camera.constants';

type Fix = { settled: false } | { settled: true; at: LatLng | null };

interface UseLaunchCameraInputs {
  enabled: boolean;
  campuses: readonly CampusDef[] | null;
  stops: ReadonlyMap<string, MapPlace> | undefined;
  stations: ReadonlyMap<string, MapPlace> | undefined;
}

function pointsOf(places: ReadonlyMap<string, MapPlace> | undefined): LatLng[] | undefined {
  return places && [...places.values()].flatMap((p) => (p.coords ? [p.coords] : []));
}

export function useLaunchCamera({ enabled, campuses, stops, stations }: UseLaunchCameraInputs): LaunchCamera | null {
  const [fix, setFix] = useState<Fix>(enabled ? { settled: false } : { settled: true, at: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getFixWithoutPrompt(LAUNCH_FIX_TIMEOUT_MS)
      .then((coords) => {
        if (!cancelled) setFix({ settled: true, at: coords && { lat: coords.latitude, lng: coords.longitude } });
      })
      .catch((e: unknown) => {
        logHandledError('useLaunchCamera/fix', e);
        if (!cancelled) setFix({ settled: true, at: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const [placesWaited, setPlacesWaited] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setPlacesWaited(true), LAUNCH_PLACES_WAIT_MS);
    return () => clearTimeout(timer);
  }, [enabled]);

  return useMemo(() => {
    if (!enabled) return { kind: 'campus' };
    if (!fix.settled || !campuses) return null;
    const nearby = launchNearbyOf({ stops: pointsOf(stops), stations: pointsOf(stations), waited: placesWaited });
    const decision = decideLaunchCamera({ fix: fix.at, campuses, nearby });
    return decision.kind === 'wait' ? null : decision;
  }, [enabled, fix, campuses, stops, stations, placesWaited]);
}
