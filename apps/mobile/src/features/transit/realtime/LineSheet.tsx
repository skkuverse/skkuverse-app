import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { InfoIcon } from 'phosphor-react-native';
import { hexToColor, SdsSpacing, SdsTypeScale, useT } from '@skkuverse/shared';
import {
  SHEET_HANDLE_HEIGHT,
  ResultSection,
  Sheet,
  SheetCloseButton,
  SheetIconButton,
  Tab,
  Txt,
  createThemedStyles,
  useSemanticColors,
} from '@skkuverse/sds';
import type { MapSheetViewProps } from '@/features/map/sheet-views.types';
import { useMapLayout } from '@/features/map/useMapLayout';
import { REFRESH_FAB_CLEARANCE, RefreshFab } from '../components/RefreshFab';
import { BusMarker } from './BusMarker';
import { STATION_ROW_HEIGHT } from './marker-geometry.rules';
import { RealtimeSkeleton } from './RealtimeSkeleton';
import { StationRow } from './StationRow';
import { useLineSheet } from './useLineSheet';

const PAGE_TITLE_SCALE = SdsTypeScale.t6.fontSize / SdsTypeScale.t9.fontSize;

export function LineSheet({ tab, entry, sheet, presentation }: MapSheetViewProps<'line'>) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const {
    status,
    label,
    themeColor,
    infoUrl,
    onInfoPress,
    onRetry,
    onClose,
    tabs,
    activeSectionId,
    onSelectDirection,
    scrollRef,
    onScroll,
    onScrollBeginDrag,
    onScrollToTop,
    onContentSizeChange,
    onLayout,
    onBodyLayout,
    rows,
    lineShape,
    onStationPress,
    arrivals,
    vehicles,
    hasPlates,
    refreshIntervalSec,
    clockOffsetMs,
    dataUpdatedAt,
    resumedAtMs,
    awaitingFreshPoll,
    nowMs,
    bottomPadding,
    refreshBottomInset,
    onRefresh,
  } = useLineSheet(tab, entry, sheet, presentation);

  const lineColor = hexToColor(themeColor, color.bg.dataBrand);
  const { pageProgress } = sheet;
  // WHY: body coordinates start at the sheet's live top plus the grabber, not at the page's status-bar spacer,
  // since an absolute child is placed from the body's own top whatever its siblings take up.
  const layout = useMapLayout();
  const { sheetTop } = layout;
  const sheetTopValue = sheetTop[tab];
  const containerHeight = layout.containerHeight;
  const { bodyReveal } = sheet;
  const refreshPlacement = useAnimatedStyle(() => ({
    opacity: bodyReveal.get(),
    top:
      containerHeight -
      refreshBottomInset -
      REFRESH_FAB_CLEARANCE -
      sheetTopValue.get() -
      SHEET_HANDLE_HEIGHT,
  }));
  const compactHeader = useAnimatedStyle(() => ({ paddingBottom: SdsSpacing.x2 * (1 - pageProgress.get()) }));
  const compactTitle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - PAGE_TITLE_SCALE) * pageProgress.get() }],
  }));

  return (
    <>
      <Animated.View style={[styles.header, compactHeader]}>
        <Animated.View style={[styles.title, compactTitle]}>
          <Txt typography="t9" fontWeight="bold" color="neutral" numberOfLines={1}>
            {label}
          </Txt>
        </Animated.View>
        {infoUrl ? <SheetIconButton icon={InfoIcon} label={t('realtime.info')} onPress={onInfoPress} /> : null}
        <SheetCloseButton label={t('common.close')} onPress={onClose} />
      </Animated.View>

      <Revealing reveal={sheet.bodyReveal} hidden={presentation.body === 'headerOnly'}>
        {status === 'ready' ? (
          <>
            {activeSectionId && tabs.length > 0 ? (
              <Tab value={activeSectionId} onChange={onSelectDirection} size="small" style={styles.tabs}>
                {tabs.map((s) => (
                  <Tab.Item key={s.id} value={s.id}>
                    {s.label}
                  </Tab.Item>
                ))}
              </Tab>
            ) : null}
            <Sheet.ScrollView
              ref={scrollRef}
              scrollEventsHandlersHook={sheet.scrollEvents}
              onScroll={onScroll}
              onScrollBeginDrag={onScrollBeginDrag}
              onScrollToTop={onScrollToTop}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: bottomPadding }}
            >
              {lineShape ? (
                <View onLayout={onBodyLayout}>
                  {rows.map((row) => (
                    <StationRow
                      key={row.station.index}
                      station={row.station}
                      themeColor={themeColor ?? ''}
                      arrival={arrivals.lines.get(row.station.index)}
                      showsStopDetails
                      onPress={row.stopId ? () => onStationPress(row) : undefined}
                    />
                  ))}
                  {lineShape.isLoop && <View style={styles.loopReturn} />}
                  {vehicles.map((vehicle) => (
                    <BusMarker
                      key={vehicle.id}
                      vehicle={vehicle}
                      line={lineShape}
                      hasPlates={hasPlates}
                      isLowFloor={arrivals.lowFloorIds.has(vehicle.id)}
                      color={lineColor}
                      refreshIntervalSec={refreshIntervalSec}
                      clockOffsetMs={clockOffsetMs}
                      pollAtMs={dataUpdatedAt}
                      resumedAtMs={resumedAtMs}
                      holding={awaitingFreshPoll}
                      nowMs={nowMs}
                    />
                  ))}
                </View>
              ) : null}
            </Sheet.ScrollView>
          </>
        ) : (
          <Sheet.ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomPadding }}>
            {status === 'loading' ? (
              <RealtimeSkeleton />
            ) : (
              <ResultSection
                size="large"
                title={t('transit.loadFailed')}
                primaryActionProps={{ children: t('common.retry'), onPress: onRetry }}
              />
            )}
          </Sheet.ScrollView>
        )}
      </Revealing>
      {/* QUIRK(gorhom-bottom-sheet): the body is sized to the largest detent, so its bottom is under the screen at
          every other one; the button is placed from the sheet's live top instead. */}
      {status === 'ready' ? (
        <Animated.View style={[styles.refresh, refreshPlacement]} pointerEvents="box-none">
          <RefreshFab
            color={lineColor}
            bottomInset={0}
            onPress={onRefresh}
            analytics={{ content_type: 'realtime_refresh', item_id: 'fab' }}
          />
        </Animated.View>
      ) : null}
    </>
  );
}

/** WHY: hidden hides it from assistive tech too, so a screen reader does not walk rows nobody can see. */
function Revealing({ reveal, hidden, children }: { reveal: SharedValue<number>; hidden: boolean; children: ReactNode }) {
  const styles = useStyles();
  const fading = useAnimatedStyle(() => ({ opacity: reveal.get() }));
  return (
    <Animated.View
      style={[styles.revealing, fading]}
      pointerEvents={hidden ? 'none' : 'auto'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </Animated.View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  revealing: {
    flex: 1,
  },
  refresh: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: REFRESH_FAB_CLEARANCE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: SdsSpacing.gutter,
  },
  title: {
    flex: 1,
    transformOrigin: 'left center',
  },
  tabs: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.stroke.neutralWeak,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loopReturn: {
    height: STATION_ROW_HEIGHT,
  },
}));
