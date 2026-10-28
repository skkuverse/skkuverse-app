import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@skkuverse/shared';
import { isPageReturn } from '@/platform/analytics.rules';
import { readNow, useNow } from '@/platform/clock';
import { handleSduiAction } from '@/features/web/web.service';
import { campusRoutesQueryOptions } from './campus-routes.client';
import { routeViewSnapshots } from './campus-routes.store';
import { ROUTES_REFETCH_MS } from './campus-routes.constants';
import { isRefetchDue, serverNowAt, toOptionView } from './campus-routes.rules';
import { rideKey } from './route-view.rules';
import type { OptionView, PlaceAction, RideExpansion } from './campus-routes.types';

const TICK_MS = 15_000;

export type RouteDetailState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'ready'; title: string; options: OptionView[] };

// SEE: docs/explanation/shared-map.md
// WHY: a failed refetch keeps the last answer on screen; only a failed first load shows the error.
export function useRouteDetail(
  routeId: string | undefined,
  source: string | undefined,
): RouteDetailState & {
  onRetry: () => void;
  onPlacePress: (action: PlaceAction) => void;
  ridesOf: (option: number) => RideExpansion;
  initialScrollY: number;
  settled: boolean;
  onScroll: (y: number) => void;
} {
  const lang = useSettingsStore((s) => s.appLanguage);
  const [focused, setFocused] = useState(true);
  const query = useQuery({
    ...campusRoutesQueryOptions(),
    refetchInterval: focused ? ROUTES_REFETCH_MS : false,
    refetchIntervalInBackground: false,
  });
  const { data, refetch, dataUpdatedAt } = query;
  // WHY: the interval does not fetch on a return, so a screen refocused after its answer went stale asks at once.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (isRefetchDue(dataUpdatedAt, readNow())) void refetch();
      return () => setFocused(false);
    }, [dataUpdatedAt, refetch]),
  );
  const deviceNow = useNow(TICK_MS);
  const now = serverNowAt(data, deviceNow);
  const route = data?.routes.find((r) => r.id === routeId);
  const options = useMemo(() => route?.options.map((option) => toOptionView(option, now, lang)), [route, now, lang]);

  // WHY: read once; a return starts where the page was left, a fresh open at the top with every ride closed.
  const [saved] = useState(() => (routeId && isPageReturn(source) ? routeViewSnapshots.read(routeId) : null));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(saved?.expanded));
  const scrollY = useRef(saved?.scrollY ?? 0);
  const ridesOf = useCallback(
    (option: number): RideExpansion => {
      // WHY: keyed by option id, so a refetch that reorders options keeps the open rides.
      const optionId = route?.options[option]?.id ?? String(option);
      return {
        isExpanded: (index) => expanded.has(rideKey(optionId, index)),
        toggle: (index) =>
          setExpanded((open) => {
            const next = new Set(open);
            const key = rideKey(optionId, index);
            if (!next.delete(key)) next.add(key);
            return next;
          }),
      };
    },
    [expanded, route],
  );

  const state: RouteDetailState = data
    ? route && options
      ? { status: 'ready', title: route.name, options }
      : { status: 'notFound' }
    : query.isError
      ? { status: 'error' }
      : { status: 'loading' };

  return {
    ...state,
    onRetry: () => void refetch(),
    onPlacePress: (action) => {
      if (!routeId) return;
      routeViewSnapshots.save(routeId, { expanded: [...expanded], scrollY: scrollY.current });
      handleSduiAction({ ...action, source: 'route_detail', origin: { href: '/routes/[routeId]', params: { routeId } } });
    },
    ridesOf,
    initialScrollY: saved?.scrollY ?? 0,
    settled: state.status === 'ready' && !query.isFetching,
    onScroll: (y) => {
      scrollY.current = y;
    },
  };
}
