import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useT } from '@skkuverse/shared';
import {
  SHEET_DETENT_PERCENT,
  Sheet,
  SheetScrollEventsContext,
  sheetPageRamp,
  type SheetPosition,
  type SheetRef,
} from '@skkuverse/sds';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarInsetContext, useTabBarInset } from '@/components/useTabBarInset';
import { useScreenReader } from '@/platform/useScreenReader';
import {
  SheetDrivesBarContext,
  SheetListHoldContext,
  useSheetDrivesBar,
  useSheetScrollEvents,
} from './components/useSheetDrivesBar';
import { useSheetStack } from './components/useSheetStack';
import { dismissAction } from './map-task.rules';
import { closeSheet } from './map.service';
import type { MapTabId } from './map-config.types';
import type { MapSheetEntry, MapSheetKind } from './sheet-stack.types';
import type { MapSheetViewDef, MapSheetViewTable } from './sheet-views.types';
import { LOCATE_PARK, REVEAL, type MapDetent } from './sheet-detents.constants';
import {
  bodyRevealAt,
  openingLevel,
  parkTopOf,
  stopsOf,
  type DetentMeasure,
  type MapSheetStops,
  type RootSheet,
} from './sheet-detents.rules';
import { MAP_SHEET_PROFILES, type MapRootProfileName, type MapSheetProfile } from './sheet-stack.constants';
import { bodyLabelOf, coversTabBarOf, presentationAt, toSheetStackLayout, topProfile } from './sheet-stack.rules';
import { useMapLayout } from './useMapLayout';
import { useMapRegistry } from './useMapRegistry';
import { useMapTask } from './useMapTask';

interface MapSheetStackProps {
  tab: MapTabId;
  /** WHY: `legacyPosition` is passed as data, so no feature reads the shell. */
  root: {
    body: ReactNode;
    profile: MapRootProfileName;
    label: string;
    onDetent?: (detent: MapDetent) => void;
    legacyPosition?: SheetPosition;
  };
}

/** WHY: an entry and its view always agree on the kind, but TypeScript cannot correlate the two lookups. */
function viewFor(views: Partial<MapSheetViewTable>, entry: MapSheetEntry): MapSheetViewDef<MapSheetKind> | undefined {
  return views[entry.request.kind] as MapSheetViewDef<MapSheetKind> | undefined;
}

/**
 * QUIRK(react-compiler): it treats a hook's arguments as frozen and a function's return value as still mutable,
 * so the stops are a hook; gorhom takes their position as its snap points.
 */
function useInlineStops(
  profile: MapSheetProfile | null,
  root: RootSheet,
  table: DetentMeasure,
  labels: Readonly<Record<MapDetent, string>>,
): MapSheetStops {
  return useMemo(() => stopsOf(profile, root, table, labels), [profile, root, table, labels]);
}

function useRootSheet(profile: MapRootProfileName, legacyPosition: SheetPosition | undefined): RootSheet {
  return useMemo(() => ({ profile: MAP_SHEET_PROFILES[profile], legacyPosition: legacyPosition ?? null }), [profile, legacyPosition]);
}

export function MapSheetStack({ tab, root }: MapSheetStackProps) {
  const registry = useMapRegistry();
  const hostLayout = useMapLayout();

  // WHY: a `select` of the same kind keeps its card mounted and its ref; plain objects, since the set is constant.
  const cardRefs = useMemo(() => {
    const refs = new Map<MapSheetKind, RefObject<SheetRef | null>>();
    for (const kind of Object.keys(registry.views) as MapSheetKind[]) refs.set(kind, { current: null });
    return refs;
  }, [registry.views]);

  const { task } = useMapTask(tab);
  const layout = toSheetStackLayout(task, registry.views);
  const { bodies, cards } = layout;
  const profile = topProfile(layout, registry.views);
  const rootSheet = useRootSheet(root.profile, root.legacyPosition);
  const { t } = useT();
  const levelLabels = useMemo(
    () => ({
      min: t('map.sheet.a11y.detent.min'),
      mid: t('map.sheet.a11y.detent.mid'),
      max: t('map.sheet.a11y.detent.max'),
      page: t('map.sheet.a11y.detent.page'),
    }),
    [t],
  );
  const table = hostLayout.detentMeasure[tab];
  const stops = useInlineStops(profile, rootSheet, table, levelLabels);
  const rootStops = useInlineStops(null, rootSheet, table, levelLabels);

  const {
    sheetRef,
    sheetIndex,
    handleSheetChange,
    handleSheetClose,
    presentOverSheet,
    onCardDismiss,
    onCardGone,
    onNavigateAway,
    snapTo,
  } = useSheetStack(tab, stops, cardRefs, root.onDetent);
  const screenReader = useScreenReader();
  const dismissWord = dismissAction(task);
  // WHY: off gorhom's index copy, which can trail the body by a frame that a collapse and a fade do not show.
  const { pageIndex, bodyReveal: revealTable, barIndex } = stops;
  const pageProgress = useDerivedValue(
    () => (pageIndex < 0 ? 0 : sheetPageRamp(sheetIndex.get(), pageIndex)),
    [pageIndex],
  );
  const bodyReveal = useDerivedValue(() => bodyRevealAt(sheetIndex.get(), revealTable), [revealTable]);
  const drivesBar = useSheetDrivesBar(sheetIndex, barIndex);
  const listHold = useSharedValue<number | null>(null);
  // WHY: handed to the view as its own prop, so the `sheet` object keeps its identity across detents.
  const topBody = bodies.at(-1);
  const presentation = presentationAt(profile, topBody?.detent ?? profile?.opening ?? 'min');
  // WHY: under a screen reader the sheet stays at its top, where it opened.
  const sheet = useMemo(
    () => ({
      lowerToReveal: () => snapTo(openingLevel(REVEAL, stops, screenReader)),
      dismiss: () => closeSheet(tab, { kind: 'close' }),
      dismissAction: dismissWord,
      pageProgress,
      bodyReveal,
      scrollEvents: useSheetScrollEvents,
      holdListAt: (y: number) => listHold.set(y),
    }),
    [snapTo, stops, screenReader, tab, dismissWord, pageProgress, bodyReveal, listHold],
  );

  const { registerSheetActions } = registry;
  const { lowerToReveal } = sheet;
  useEffect(() => {
    registerSheetActions(tab, { lowerToReveal });
    return () => registerSheetActions(tab, null);
  }, [registerSheetActions, tab, lowerToReveal]);

  // WHY: from the root's own levels, so no tab can leave the row riding a full sheet over the status bar.
  const { sheetAnchor } = hostLayout;
  const { publishRootSheet } = registry;
  const anchorTop = parkTopOf(
    rootStops,
    LOCATE_PARK,
    hostLayout.containerHeight,
    SHEET_DETENT_PERCENT,
    hostLayout.floatInset,
  );
  useEffect(() => {
    sheetAnchor[tab].set(anchorTop);
  }, [sheetAnchor, tab, anchorTop]);

  useEffect(() => {
    publishRootSheet(tab, rootSheet);
  }, [publishRootSheet, tab, rootSheet]);

  const bodyLabel = bodyLabelOf(layout, registry.views);
  const label = bodyLabel ? t(bodyLabel) : root.label;
  const accessibility = {
    label,
    detentLabels: { small: t('sheet.a11y.small'), medium: t('sheet.a11y.medium'), large: t('sheet.a11y.large') },
  };

  // WHY: seeded from the stack, since a stack that mounts with a sheet open never mounts its root body to say so.
  const [rootShown, setRootShown] = useState(() => bodies.length === 0);
  const coversTabBar = coversTabBarOf(rootShown);
  const { publishCoversTabBar } = registry;
  useEffect(() => {
    publishCoversTabBar(tab, coversTabBar);
  }, [publishCoversTabBar, tab, coversTabBar]);
  useEffect(() => () => publishCoversTabBar(tab, false), [publishCoversTabBar, tab]);
  const homeIndicator = useSafeAreaInsets().bottom;
  const tabBarInset = useTabBarInset();
  const contentBottomInset = coversTabBar ? homeIndicator : tabBarInset;
  // WHY: glass throughout, so content paints no layer fill (COLOR-12); a stack in SDS heights keeps its old rule.
  const surface = root.legacyPosition && !rootShown ? 'solid' : 'glass';

  let body: ReactNode = <RootBodyPresence onPresence={setRootShown}>{root.body}</RootBodyPresence>;
  for (const entry of bodies) {
    const def = viewFor(registry.views, entry);
    if (def?.presentation !== 'swap') continue;
    body = <def.View key={entry.id} tab={tab} entry={entry} fallback={body} sheet={sheet} presentation={presentation} />;
  }

  return (
    <>
      {task.stack.map((entry) => {
        const Tracking = viewFor(registry.views, entry)?.Tracking;
        return Tracking ? <Tracking key={entry.id} tab={tab} entry={entry} /> : null;
      })}
      <Sheet
        ref={sheetRef}
        presentation="inline"
        position={stops.position}
        surface={surface}
        // WHY: an inline sheet's percentage detents resolve against its container, not the window.
        containerHeight={hostLayout.containerHeight}
        animatedPosition={hostLayout.sheetTop[tab]}
        animatedIndex={sheetIndex}
        onChange={handleSheetChange}
        onClose={handleSheetClose}
        accessibility={accessibility}
      >
        <SheetScrollEventsContext.Provider value={useSheetScrollEvents}>
          <SheetDrivesBarContext.Provider value={drivesBar}>
            <SheetListHoldContext.Provider value={listHold}>
              {/* WHY: one provider throughout, so a switch does not remount the body. */}
              <TabBarInsetContext.Provider value={contentBottomInset}>{body}</TabBarInsetContext.Provider>
            </SheetListHoldContext.Provider>
          </SheetDrivesBarContext.Provider>
        </SheetScrollEventsContext.Provider>
      </Sheet>
      {cards.map((entry) => {
        const sheetRefOfKind = cardRefs.get(entry.request.kind);
        if (!sheetRefOfKind) return null;
        return (
          <OverCard
            // WHY: by kind, so a `select` of the same kind switches the card's content in place instead of re-presenting.
            key={entry.request.kind}
            tab={tab}
            entry={entry}
            def={viewFor(registry.views, entry)}
            sheetRef={sheetRefOfKind}
            bottomGap={hostLayout.modalCardBottomGap}
            presentOverSheet={presentOverSheet}
            onDismiss={onCardDismiss}
            onGone={onCardGone}
            onNavigateAway={onNavigateAway}
          />
        );
      })}
    </>
  );
}

function RootBodyPresence({ onPresence, children }: { onPresence: (shown: boolean) => void; children: ReactNode }) {
  useLayoutEffect(() => {
    onPresence(true);
    return () => onPresence(false);
  }, [onPresence]);
  return children;
}

interface OverCardProps {
  tab: MapTabId;
  entry: MapSheetEntry;
  def: MapSheetViewDef<MapSheetKind> | undefined;
  sheetRef: RefObject<SheetRef | null>;
  bottomGap: number;
  presentOverSheet: (modal: RefObject<SheetRef | null>) => void;
  onDismiss: (id: number) => void;
  onGone: (id: number) => void;
  onNavigateAway: (id: number) => void;
}

function OverCard({ tab, entry, def, sheetRef, bottomGap, presentOverSheet, onDismiss, onGone, onNavigateAway }: OverCardProps) {
  useEffect(() => {
    presentOverSheet(sheetRef);
  }, [presentOverSheet, sheetRef, entry.id]);

  const handleDismiss = useCallback(() => onDismiss(entry.id), [onDismiss, entry.id]);
  const handleGone = useCallback(() => onGone(entry.id), [onGone, entry.id]);
  const handleNavigateAway = useCallback(() => onNavigateAway(entry.id), [onNavigateAway, entry.id]);

  if (def?.presentation !== 'over') return null;
  return (
    <def.View
      tab={tab}
      entry={entry}
      sheetRef={sheetRef}
      bottomGap={bottomGap}
      onDismiss={handleDismiss}
      onGone={handleGone}
      onNavigateAway={handleNavigateAway}
    />
  );
}
