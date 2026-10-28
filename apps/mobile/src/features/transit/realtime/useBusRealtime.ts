import { useCallback, useEffect, useMemo } from 'react';
import { useNow } from '@/platform/clock';
import { useRouter } from 'expo-router';
import { logBusContentSelect, logBusRouteOpen } from '@/platform/analytics';
import { asEntrySource } from '@/platform/analytics.rules';
import { useTransitLoadError } from '../components/useTransitLoadError';
import { useRealtimeArrivals } from './components/useRealtimeArrivals';
import { useServerClockOffset } from '../components/useServerClockOffset';
import { useResumedAt } from './components/useResumedAt';
import { useAwaitingFreshPoll } from './components/useAwaitingFreshPoll';
import { useBusConfig } from '../useBusConfig';
import { useLiveGroup } from './useLiveGroup';
import { toInfoUrl } from '../transit.rules';
import { isPlaced } from './line.rules';

export function useBusRealtime(groupId: string, source: string | undefined) {
  const router = useRouter();
  const { data: config, isLoading: configLoading, isError: configError } = useBusConfig(groupId);
  // WHY: no error UI for the config; a failed one leaves the skeleton up.
  useTransitLoadError('bus_config', groupId, configError && !config);

  const isRealtime = config?.screenType === 'realtime';
  const screenConfig = isRealtime ? config.screen : undefined;

  useEffect(() => {
    if (!config || !groupId) return;
    logBusRouteOpen({
      routeId: groupId,
      routeLabel: config.label,
      screenType: 'realtime',
      source: asEntrySource(source),
    });
  }, [config?.label, groupId]); // eslint-disable-line react-hooks/exhaustive-deps -- one open per route, not per change of entry source

  const { data: live, dataUpdatedAt, refetch } = useLiveGroup(
    screenConfig?.liveEndpoint,
    screenConfig?.refreshInterval,
  );

  const clockOffsetMs = useServerClockOffset(live?.serverNowMs, dataUpdatedAt);
  // WHY: one clock for the whole screen, so the markers, the countdowns and the hold after a
  // return all read the same instant in the same render.
  const nowMs = useNow(1000);
  const resumedAtMs = useResumedAt(nowMs);
  const awaitingFreshPoll = useAwaitingFreshPoll(dataUpdatedAt, resumedAtMs, nowMs);
  const arrivals = useRealtimeArrivals(
    live,
    clockOffsetMs,
    screenConfig?.hasLowFloor ?? false,
    awaitingFreshPoll,
    nowMs,
  );
  const vehicles = useMemo(() => live?.vehicles.filter(isPlaced) ?? [], [live]);
  // WHY: the poller has stopped writing, so no bus is known, which is not "no bus".
  const noInfo = live?.updatedAtMs === null;

  // WHY: the server's empty `features[]` is the source for whether a line has an info page; never add a
  // fallback URL, which showed the button on every bus and opened HSSC's page.
  const infoUrl = screenConfig ? toInfoUrl(screenConfig.features) : undefined;

  const handleInfoPress = useCallback(() => {
    if (!infoUrl || !config) return;
    logBusContentSelect({ content_type: 'realtime_info', item_id: groupId ?? '' });
    router.push({
      pathname: '/webview',
      params: {
        title: config.label,
        color: config.card.themeColor,
        url: infoUrl,
      },
    } as never);
  }, [infoUrl, config, router, groupId]);

  return {
    config,
    configLoading,
    screenConfig,
    vehicles,
    noInfo,
    dataUpdatedAt,
    resumedAtMs,
    awaitingFreshPoll,
    nowMs,
    refetch,
    arrivals,
    clockOffsetMs,
    infoUrl,
    handleInfoPress,
  };
}
