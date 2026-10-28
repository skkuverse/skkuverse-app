import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS_AVAILABLE, SHEET_DETENT_PERCENT, SHEET_FLOAT_INSET, SHEET_HANDLE_HEIGHT } from '@skkuverse/sds';
import { useTabBarInset } from '@/components/useTabBarInset';
import { devLog } from '@/platform/dev-log';
import { logoMarginOf, sdkMapPadding, visibleMapPadding, type MapPadding } from '../../camera-move.rules';
import { MAP_FRAME_MARGIN, MIN_VISIBLE_BAND } from '../../camera.constants';
import { MAP_CONTROL_GAP, MAP_CONTROL_HEIGHT, MAP_TOOLBAR_HEIGHT, MAP_TOP_INSET_GAP, MAP_TOP_ROW_GAP } from '../../map-layout.constants';
import { controlsBottomOf } from '../../map-layout.rules';
import { topEntry } from '../../map-task.rules';
import type { MapConfig, MapTabId } from '../../map-config.types';
import { contentBottomOf, coveredAt, logoBandOf, stopsOf, type DetentMeasure, type RootSheet } from '../../sheet-detents.rules';
import type { TopChromeName } from '../../sheet-stack.constants';
import { framingDetentOf, presentationAt, profileOf } from '../../sheet-stack.rules';
import type { MapTaskState } from '../../sheet-stack.types';
import type { MapSheetViewTable } from '../../sheet-views.types';
import type { MapLayout } from '../../map-host.types';

interface UseHostLayoutInputs {
  sheetViews: Partial<MapSheetViewTable>;
  mapConfig: MapConfig | null;
  activeTab: MapTabId;
  activeTask: MapTaskState;
  toolbar: boolean;
  visibleMapCamera: boolean;
  mapChipRow: boolean;
  transitChipRow: boolean;
  rootSheets: Partial<Record<MapTabId, RootSheet>>;
  coveredTabs: MapLayout['coveredTabs'];
}

export function useHostLayout({
  sheetViews,
  mapConfig,
  activeTab,
  activeTask,
  toolbar,
  visibleMapCamera,
  mapChipRow,
  transitChipRow,
  rootSheets,
  coveredTabs,
}: UseHostLayoutInputs) {
  /** WHY: seeded with the window height, not 0, so the row starts just off the bottom rather than flashing at the top. */
  const { height: windowHeight } = useWindowDimensions();

  const mapSheetTop = useSharedValue(windowHeight);

  const transitSheetTop = useSharedValue(windowHeight);

  const sheetTop = useMemo(() => ({ map: mapSheetTop, transit: transitSheetTop }), [mapSheetTop, transitSheetTop]);

  const mapSheetAnchor = useSharedValue(0);

  const transitSheetAnchor = useSharedValue(0);

  const sheetAnchor = useMemo(
    () => ({ map: mapSheetAnchor, transit: transitSheetAnchor }),
    [mapSheetAnchor, transitSheetAnchor],
  );

  /**
   * WHY: measured, since an inline sheet's percentage snaps resolve against this root view, which is not the
   * window under JSX `<Tabs>`.
   */
  const [sheetContainerHeight, setSheetContainerHeight] = useState(0);

  const [mapWidth, setMapWidth] = useState(0);

  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    setSheetContainerHeight(e.nativeEvent.layout.height);
    setMapWidth(e.nativeEvent.layout.width);
  }, []);

  /**
   * WHY: a modal is portalled to the window, so the inline card's bottom edge is restated in window terms. Only
   * with glass; elsewhere `Sheet` attaches and ignores it, so a layout reading it must check `GLASS_AVAILABLE`.
   */
  const modalCardBottomGap = useMemo(
    () =>
      sheetContainerHeight > 0
        ? windowHeight - sheetContainerHeight + SHEET_FLOAT_INSET
        : SHEET_FLOAT_INSET,
    [windowHeight, sheetContainerHeight],
  );

  /**
   * QUIRK(ios): from iOS 26 NativeTabs floats its tab bar over a full-window tab and reports its height only
   * through the tab view's own safe area, which the `SafeAreaListener` in `MapHost` measures; the root provider
   * cannot. The shared-map shell provides its bar through `useTabBarInset`.
   */
  const [measuredOverlap, setMeasuredOverlap] = useState<number | null>(null);

  const handleSafeAreaChange = useCallback(
    ({ insets: measured }: { insets: { bottom: number } }) => setMeasuredOverlap(measured.bottom),
    [],
  );

  const providedInset = useTabBarInset();

  const tabBarOverlap = Math.max(measuredOverlap ?? 0, providedInset);

  /** WHY: until the overlap is known `min` holds its stand-in, so a resting sheet does not move when it lands. */
  const overlapKnown = measuredOverlap !== null || providedInset > 0;

  const sheetContentBottom = contentBottomOf(tabBarOverlap);

  /** WHY: keyed on the top's kind and settled detent alone, never the task object, which a camera settle replaces. */
  const top = topEntry(activeTask);

  const topKind = top?.request.kind ?? null;

  const topDetent = top?.detent ?? null;

  const topProfile = topKind ? profileOf(sheetViews[topKind]) : null;

  const presentation = useMemo(
    () => presentationAt(topProfile, topDetent ?? topProfile?.opening ?? 'min'),
    [topProfile, topDetent],
  );

  const chrome = presentation.chrome;

  const framingDetent = framingDetentOf(topProfile, topDetent);

  const insets = useSafeAreaInsets();

  /**
   * EVIDENCE: a swap re-lays the column out a frame later, and a frame in between fitted a route under the old
   * chrome (simulator, 2026-10-24), so the height is recorded with the chrome it was measured for.
   */
  const [controls, setControls] = useState<{ chrome: TopChromeName; height: number } | null>(null);

  const handleControlsLayout = useCallback(
    (e: LayoutChangeEvent) => setControls({ chrome, height: e.nativeEvent.layout.height }),
    [chrome],
  );

  const chromeSettled = chrome === 'none' || controls?.chrome === chrome;

  // EVIDENCE: zeroing the height at `none` rebuilt the sheet's position and re-fired every opening snap, so a
  // sheet dragged to the page snapped back (simulator, 2026-10-24).
  const controlsHeight = chromeSettled ? (controls?.height ?? 0) : 0;

  const controlsBottom = controlsHeight > 0 ? insets.top + MAP_TOP_INSET_GAP + controlsHeight + MAP_TOP_ROW_GAP : 0;

  const toolbarHeight = toolbar ? MAP_TOOLBAR_HEIGHT : MAP_CONTROL_HEIGHT;

  const minFrame = overlapKnown ? SHEET_HANDLE_HEIGHT + sheetContentBottom : null;

  const detentMeasure = useMemo<Readonly<Record<MapTabId, DetentMeasure>>>(() => {
    const of = (chipRow: boolean): DetentMeasure => ({
      containerHeight: sheetContainerHeight,
      controlsBottom: {
        world: controlsBottomOf('world', { topInset: insets.top, toolbarHeight, chipRow }),
        taskField: controlsBottomOf('taskField', { topInset: insets.top, toolbarHeight, chipRow }),
      },
      minFrame,
    });
    return { map: of(mapChipRow), transit: of(transitChipRow) };
  }, [sheetContainerHeight, insets.top, toolbarHeight, mapChipRow, transitChipRow, minFrame]);

  // WHY: a control whose height changed without its metric would leave every `max` off.
  const arithmeticBottom = chrome === 'none' ? 0 : detentMeasure[activeTab].controlsBottom[chrome];

  useEffect(() => {
    if (!__DEV__ || controlsBottom <= 0 || arithmeticBottom <= 0 || mapConfig === null) return;
    if (Math.abs(arithmeticBottom - controlsBottom) > 0.5) {
      devLog('map.controlsBottomDrift', { chrome, measured: controlsBottom, arithmetic: arithmeticBottom });
    }
  }, [chrome, controlsBottom, arithmeticBottom, mapConfig]);

  /** WHY: SDS floats a glass sheet whose top detent is not `large`, and only where Liquid Glass is. */
  const floatInset = GLASS_AVAILABLE ? SHEET_FLOAT_INSET : 0;

  /**
   * WHY: derived in render, not published from an effect, so the padding prop is mounted before the command a
   * view's frame effect dispatches.
   */
  const rootSheet = rootSheets[activeTab];

  const sheetRest = useMemo(() => {
    if (!rootSheet) return 0;
    const stops = stopsOf(topProfile, rootSheet, detentMeasure[activeTab]);
    const level = topProfile ? (framingDetent ?? topProfile.opening) : rootSheet.profile.opening;
    return coveredAt(stops, level, sheetContainerHeight, SHEET_DETENT_PERCENT, floatInset);
  }, [rootSheet, topProfile, framingDetent, sheetContainerHeight, floatInset, detentMeasure, activeTab]);

  /**
   * QUIRK(naver-map): the SDK keeps the visible map still and moves the camera's coordinate when the padding
   * changes, so the coordinate is the visible centre. Memoised so an equal rect is not re-applied natively.
   */
  const framing = presentation.framing;

  const framePadding = useMemo<MapPadding | undefined>(
    () =>
      visibleMapCamera
        ? visibleMapPadding({
            controlsBottom,
            sheetRest,
            tabBarInset: tabBarOverlap,
            margins: {
              top: framing.kind === 'fit' ? framing.margin.top : MAP_FRAME_MARGIN,
              bottom: framing.kind === 'fit' ? framing.margin.bottom : MAP_FRAME_MARGIN,
              side: MAP_FRAME_MARGIN,
            },
            containerHeight: sheetContainerHeight,
            minBand: MIN_VISIBLE_BAND,
          })
        : undefined,
    [visibleMapCamera, controlsBottom, sheetRest, tabBarOverlap, sheetContainerHeight, framing],
  );

  /** QUIRK(naver-map): iOS adds the map's safe area to the logo's offset and Android does not. */
  const logoSafeTop = Platform.OS === 'ios' ? insets.top : 0;
  const logoTop = logoBandOf(controlsBottom).paddingTop - logoSafeTop;

  const mapPadding = useMemo<MapPadding | undefined>(
    () => framePadding && sdkMapPadding(framePadding, { logoTop }),
    [framePadding, logoTop],
  );

  const logoMargin = useMemo(() => logoMarginOf(mapPadding, { logoTop }), [mapPadding, logoTop]);

  /** WHY: written in the commit that changes the padding, so the frame matches the padding the SDK has. */
  const fitSpace = useRef<{ band: MapPadding; padding: MapPadding; size: { width: number; height: number } } | null>(null);

  useLayoutEffect(() => {
    fitSpace.current =
      framePadding && mapPadding && mapWidth > 0
        ? { band: framePadding, padding: mapPadding, size: { width: mapWidth, height: sheetContainerHeight } }
        : null;
  }, [framePadding, mapPadding, mapWidth, sheetContainerHeight]);

  /** WHY: `max` because Y grows downward: a sheet dragged above the anchor is clamped and the row holds its place. */
  const tabSheetTop = sheetTop[activeTab];

  const tabSheetAnchor = sheetAnchor[activeTab];

  const locateStyle = useAnimatedStyle(() => {
    const top = Math.max(tabSheetTop.value, tabSheetAnchor.value);
    return {
      transform: [{ translateY: top - MAP_CONTROL_HEIGHT - MAP_CONTROL_GAP }],
    };
  }, [tabSheetTop, tabSheetAnchor]);

  const visibleMapKnown =
    visibleMapCamera &&
    rootSheet !== undefined &&
    sheetContainerHeight > 0 &&
    controlsHeight > 0 &&
    chromeSettled &&
    mapConfig !== null;

  const visibleMapReady = !visibleMapCamera || visibleMapKnown;

  const layout = useMemo<MapLayout>(
    () => ({
      containerHeight: sheetContainerHeight,
      controlsBottom,
      floatInset,
      visibleMapReady,
      modalCardBottomGap,
      sheetContentBottom,
      detentMeasure,
      sheetTop,
      sheetAnchor,
      coveredTabs,
    }),
    [
      sheetContainerHeight,
      controlsBottom,
      floatInset,
      visibleMapReady,
      modalCardBottomGap,
      sheetContentBottom,
      detentMeasure,
      sheetTop,
      sheetAnchor,
      coveredTabs,
    ],
  );

  return {
    layout,
    visibleMapKnown,
    handleRootLayout,
    modalCardBottomGap,
    handleSafeAreaChange,
    presentation,
    chrome,
    handleControlsLayout,
    mapPadding,
    logoMargin,
    fitSpace,
    locateStyle,
  };
}
