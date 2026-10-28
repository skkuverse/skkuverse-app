import { useEffect, useEffectEvent, useRef } from 'react';
import type { SubwayDirectionKey } from '@skkuverse/shared';
import { useTransitLoadError } from '../components/useTransitLoadError';
import { track } from '@/platform/analytics';
import { asEntrySource } from '@/platform/analytics.rules';
import { decideSubwayViewSource, type SubwayChoiceSource, type SubwayTap } from './subway.rules';

export interface SubwayShown {
  line: string;
  direction: SubwayDirectionKey;
  trains: number;
  picked: SubwayChoiceSource;
}

interface SubwayTrackingInputs {
  station: string | undefined;
  lineParam: string | undefined;
  source: string | undefined;
  shown: SubwayShown | undefined;
  failed: boolean;
  retry: () => unknown;
}

// WHY: `subway_view` fires once per line and direction, not per poll; `onTap` must be marked before the state update.
export function useSubwayTracking({
  station,
  lineParam,
  source,
  shown,
  failed,
  retry,
}: SubwayTrackingInputs): { onTap: (tap: SubwayTap) => void; onRetry: () => void } {
  const tap = useRef<SubwayTap | null>(null);

  const logOpen = useEffectEvent(() => {
    if (station) track('subway_open', { station_id: station, line: lineParam, source: asEntrySource(source) });
  });
  useEffect(() => {
    logOpen();
  }, [station]);

  // WHY: the train count and the tap are read as they are when the line or direction changes; a poll changes neither.
  const logView = useEffectEvent(() => {
    if (!station || !shown) return;
    track('subway_view', {
      station_id: station,
      line: shown.line,
      direction: shown.direction,
      trains: shown.trains,
      source: decideSubwayViewSource(tap.current, shown.picked),
    });
    tap.current = null;
  });
  const line = shown?.line;
  const direction = shown?.direction;
  useEffect(() => {
    logView();
  }, [station, line, direction]);

  const { onRetry } = useTransitLoadError('subway', station, failed, retry);

  return {
    onTap: (pressed: SubwayTap) => {
      tap.current = pressed;
    },
    onRetry,
  };
}
