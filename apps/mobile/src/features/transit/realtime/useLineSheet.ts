import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { useTabBarInset } from '@/components/useTabBarInset';
import { useLayerOverlays } from '@/features/map/useLayerOverlays';
import { useMapCommands } from '@/features/map/useMapCommands';
import { useMapLayout } from '@/features/map/useMapLayout';
import { useMapWorld } from '@/features/map/useMapWorld';
import { useMapTask } from '@/features/map/useMapTask';
import { useSheetLens } from '@/features/map/useSheetLens';
import type { MapTabId } from '@/features/map/map-config.types';
import type { MapOverlayLens, MapSheetEntryOf } from '@/features/map/sheet-stack.types';
import type { MapSheetViewProps } from '@/features/map/sheet-views.types';
import { logBusContentSelect, track } from '@/platform/analytics';
import { useNow } from '@/platform/clock';
import { useAwaitingFreshPoll } from './components/useAwaitingFreshPoll';
import { useRealtimeArrivals } from './components/useRealtimeArrivals';
import { useResumedAt } from './components/useResumedAt';
import { isPlaced, toLineSections, toLineStations } from './line.rules';
import { STATION_ROW_HEIGHT } from './marker-geometry.rules';
import {
  SPY_OFFSET,
  activeSectionAt,
  listBottomPadding,
  sectionOffsets,
  spyReduce,
  tabPressScroll,
  tapScrollY,
  type SpyEvent,
  type SpyState,
} from './scroll-spy.rules';
import { useLiveGroup } from './useLiveGroup';
import { REFRESH_FAB_CLEARANCE } from '../components/RefreshFab';
import { useServerClockOffset } from '../components/useServerClockOffset';
import { useTransitLoadError } from '../components/useTransitLoadError';
import { lineMapOverlays, routeFramePoints, stopRouteLayers } from '../map-lens.rules';
import { toInfoUrl } from '../transit.rules';
import type { LineStation } from '../transit.types';
import { useBusConfig } from '../useBusConfig';
import { useBusStops } from '../useBusStops';

export function useLineSheet(
  tab: MapTabId,
  entry: MapSheetEntryOf<'line'>,
  sheet: MapSheetViewProps<'line'>['sheet'],
  presentation: MapSheetViewProps<'line'>['presentation'],
) {
  const { groupId } = entry.request;
  const router = useRouter();
  const { mapConfig } = useMapWorld();
  const { fitBounds } = useMapCommands();
  const layout = useMapLayout();
  const { push } = useMapTask(tab);
  const tabBarInset = useTabBarInset();
  const { tpl } = useT();

  const { data: config, isLoading: configLoading, isError: configError, refetch } = useBusConfig(groupId);
  const screen = config?.screenType === 'realtime' ? config.screen : undefined;
  // WHY: a schedule group has no line to draw, so the sheet reads as a failed load.
  const failed = (configError || (config !== undefined && !screen)) && !configLoading;
  const loadError = useTransitLoadError('bus_config', groupId, failed, refetch);
  const { data: stops } = useBusStops();

  const { data: live, dataUpdatedAt, refetch: refetchLive } = useLiveGroup(screen?.liveEndpoint, screen?.refreshInterval);
  const clockOffsetMs = useServerClockOffset(live?.serverNowMs, dataUpdatedAt);
  // WHY: one clock for the sheet, so the markers, the countdowns and the hold after a return read the same instant.
  const nowMs = useNow(1000);
  const resumedAtMs = useResumedAt(nowMs);
  const awaitingFreshPoll = useAwaitingFreshPoll(dataUpdatedAt, resumedAtMs, nowMs);
  const arrivals = useRealtimeArrivals(live, clockOffsetMs, screen?.hasLowFloor ?? false, awaitingFreshPoll, nowMs);

  const lineStations = useMemo(
    () => (screen && stops ? toLineStations(groupId, screen.stations, stops) : []),
    [groupId, screen, stops],
  );
  const lineShape = useMemo(
    () => (screen ? { lastStationIndex: screen.lastStationIndex, isLoop: screen.isLoop } : null),
    [screen],
  );
  const vehicles = useMemo(() => live?.vehicles.filter(isPlaced) ?? [], [live]);

  // WHY: the sheet's view is keyed by entry id, so a new line starts at section 0 with the list at offset 0.
  const sections = useMemo(() => (screen ? toLineSections(screen) : []), [screen]);
  const offsets = useMemo(() => sectionOffsets(sections, STATION_ROW_HEIGHT), [sections]);
  const [spy, setSpy] = useState<SpyState>({ kind: 'following', section: 0 });
  const dispatchSpy = useCallback((event: SpyEvent) => setSpy((state) => spyReduce(state, event)), []);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const measured = useRef({ content: 0, viewport: 0, y: 0 });
  const { listScrolls } = presentation;
  const { holdListAt } = sheet;

  const onScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      measured.current.y = contentOffset.y;
      const section = activeSectionAt(
        offsets,
        contentOffset.y + SPY_OFFSET,
        contentSize.height - layoutMeasurement.height + SPY_OFFSET,
      );
      if (section >= 0) dispatchSpy({ type: 'spy', section, y: contentOffset.y });
    },
    [offsets, dispatchSpy],
  );
  const onScrollBeginDrag = useCallback(() => {
    dispatchSpy({ type: 'drag' });
  }, [dispatchSpy]);
  const onScrollToTop = useCallback(() => {
    measured.current.y = 0;
    dispatchSpy({ type: 'top' });
  }, [dispatchSpy]);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    measured.current.content = height;
  }, []);
  // WHY: the viewport is state as well as a ref because the list's bottom padding is laid out from it.
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    measured.current.viewport = e.nativeEvent.layout.height;
    setViewportHeight(e.nativeEvent.layout.height);
  }, []);
  const [bodyHeight, setBodyHeight] = useState(0);
  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    setBodyHeight(e.nativeEvent.layout.height);
  }, []);

  const onSelectDirection = useCallback(
    (id: string) => {
      const section = sections.findIndex((s) => s.id === id);
      if (section < 0) return;
      track('item_action', { view: 'line_sheet', item_id: groupId, action: 'direction', target: id });
      const { content, viewport, y: fromY } = measured.current;
      const y = tapScrollY(offsets[section]!, content, viewport);
      dispatchSpy({ type: 'tap', section, y, fromY });
      const press = tabPressScroll(listScrolls, y);
      if (press.kind === 'scroll') scrollRef.current?.scrollTo({ y: press.y, animated: true });
      else holdListAt(press.y);
    },
    [groupId, sections, offsets, listScrolls, dispatchSpy, holdListAt],
  );
  const activeSectionId = sections[spy.section]?.id ?? null;
  const spies = sections.length > 1;

  // WHY: a view mounted over an entry that already framed (`entry.framed`, a pop back from a stop) is the
  // restore's to place; `entry.camera` cannot say so, since a push's padding change settles a camera first.
  const routeLayer = mapConfig?.layers.find((l) => l.id === `${groupId}_route`);
  const { data: routeOverlays } = useLayerOverlays(routeLayer?.endpoint ?? '', routeLayer !== undefined);
  const framePoints = useMemo(
    () => routeFramePoints(routeOverlays, groupId, lineStations),
    [routeOverlays, groupId, lineStations],
  );
  const { visibleMapReady } = layout;
  const { framing } = presentation;
  const framed = useRef<{ entry: number; detent: typeof entry.detent } | null>(null);
  useEffect(() => {
    // WHY: not before the host knows its visible map, or the frame lands under a padding of 0 and stays there.
    if (!visibleMapReady || framing.kind !== 'fit' || framePoints.every((p) => p === null)) return;
    const last = framed.current;
    if (last?.entry === entry.id && last.detent === entry.detent) return;
    framed.current = { entry: entry.id, detent: entry.detent };
    if (last === null && entry.framed) return;
    fitBounds(framePoints, { request: 'sheet' });
  }, [visibleMapReady, framing.kind, entry.id, entry.detent, entry.framed, framePoints, fitBounds]);

  const title = config?.label;
  const directions = screen?.directions;
  const routeColor = routeLayer?.style?.color;
  const lens = useMemo<MapOverlayLens | null>(
    () =>
      title === undefined
        ? null
        : {
            overlays: lineMapOverlays({
              groupId,
              stations: lineStations,
              directions: directions ?? [],
              selectedDirectionId: activeSectionId,
              towardsLabel: (name) => tpl('transit.stop.towards', name),
              routeColor,
            }),
            dimOthers: true,
            header: { title },
          },
    [groupId, lineStations, directions, activeSectionId, tpl, title, routeColor],
  );
  useSheetLens(tab, entry.id, lens);

  const onStationPress = useCallback(
    (station: LineStation) => {
      if (!station.stopId) return;
      track('item_action', { view: 'line_sheet', item_id: groupId, action: 'stop', target: station.stopId });
      push(
        {
          kind: 'bus_stop',
          stopId: station.stopId,
          source: 'line_sheet',
          line: { groupId, stationIndex: station.station.index },
        },
        mapConfig ? stopRouteLayers(stops, station.stopId, groupId, mapConfig.layers) : {},
      );
    },
    [groupId, mapConfig, push, stops],
  );

  const infoUrl = screen ? toInfoUrl(screen.features) : undefined;
  const onInfoPress = useCallback(() => {
    if (!infoUrl || !config) return;
    logBusContentSelect({ content_type: 'realtime_info', item_id: groupId });
    router.push({
      pathname: '/webview',
      params: { title: config.label, color: config.card.themeColor, url: infoUrl },
    } as never);
  }, [infoUrl, config, router, groupId]);

  const { dismiss, dismissAction } = sheet;
  const onClose = useCallback(() => {
    track('item_action', { view: 'line_sheet', item_id: groupId, action: dismissAction });
    dismiss();
  }, [groupId, dismiss, dismissAction]);

  const status = screen ? ('ready' as const) : failed ? ('error' as const) : ('loading' as const);

  return {
    status,
    label: config?.label ?? '',
    themeColor: config?.card.themeColor,
    infoUrl,
    onInfoPress,
    onRetry: loadError.onRetry,
    onClose,
    tabs: spies ? sections : [],
    activeSectionId,
    onSelectDirection,
    scrollRef,
    onScroll: spies ? onScroll : undefined,
    onScrollBeginDrag: spies ? onScrollBeginDrag : undefined,
    onScrollToTop: spies ? onScrollToTop : undefined,
    onContentSizeChange,
    onLayout,
    rows: lineStations,
    lineShape,
    onStationPress,
    arrivals,
    vehicles,
    hasPlates: screen?.hasPlates ?? false,
    refreshIntervalSec: screen?.refreshInterval ?? 15,
    clockOffsetMs,
    dataUpdatedAt,
    resumedAtMs,
    awaitingFreshPoll,
    nowMs,
    onBodyLayout,
    bottomPadding: listBottomPadding(Math.max(layout.sheetContentBottom, tabBarInset + REFRESH_FAB_CLEARANCE), {
      viewport: viewportHeight,
      body: bodyHeight,
      sectionOffsets: offsets,
    }),
    refreshBottomInset: tabBarInset,
    onRefresh: refetchLive,
  };
}
