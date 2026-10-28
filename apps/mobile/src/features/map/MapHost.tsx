/** SEE: docs/explanation/shared-map.md */

import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaListener, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CrosshairSimpleIcon, MagnifyingGlassIcon, StackSimpleIcon } from 'phosphor-react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { SdsSpacing } from '@skkuverse/shared';
import { GlassButtonGroup, GlassIconButton, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { logCampusContentSelect } from '@/platform/analytics';
import { ActiveChipStrip } from './components/chrome/ActiveChipStrip';
import { CampusChipRow } from './components/chrome/CampusChipRow';
import { CampusSuggestionCard } from './components/CampusSuggestionCard';
import { CampusToggle } from './components/chrome/CampusToggle';
import { MAP_CONTROL_HEIGHT, MAP_CONTROL_GAP, MAP_TOP_INSET_GAP, MAP_TOOLBAR_HEIGHT, MAP_TOP_ROW_GAP, MAP_SCREEN_GUTTER, MAP_CHROME_FADE_MS } from './map-layout.constants';
import { TaskField } from './components/chrome/TaskField';
import { FilterButton } from './components/chrome/FilterButton';
import { FilterSheet } from './components/FilterSheet';
import { HeadingLocateIcon } from './components/HeadingLocateIcon';
import { MapCanvas } from './components/canvas/MapCanvas';
import { MapCompass } from './components/MapCompass';
import { isFacing, isTracking } from './components/useLocationTracking';
import { openSearch } from './map.service';
import type { MapTabId } from './map-config.types';
import type { MapSheetViewTable } from './sheet-views.types';
import { useMapHost } from './useMapHost';
import { MapCommandsContext } from './useMapCommands';
import { MapLayoutContext } from './useMapLayout';
import { MapRegistryContext } from './useMapRegistry';
import { MapWorldContext } from './useMapWorld';
import type { TabScope } from './layers.rules';

interface MapHostProps {
  sheetViews: Partial<MapSheetViewTable>;
  /** CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §8.9. */
  tabScope: TabScope;
  tab: MapTabId;
  children?: ReactNode;
  /**
   * WHY: the shared map sits under every tab, where VoiceOver would otherwise reach the markers through the screen
   * in front.
   */
  hiddenFromScreenReader?: boolean;
  visibleMapCamera?: boolean;
  launchAtUser?: boolean;
  campusSuggestions?: boolean;
  /** WHY: off under Reduce Transparency (ADR 0023 d2). */
  toolbar?: { glass: boolean };
}

export function MapHost({
  sheetViews,
  tabScope,
  tab,
  children,
  hiddenFromScreenReader,
  visibleMapCamera = false,
  launchAtUser = false,
  campusSuggestions = true,
  toolbar,
}: MapHostProps) {
  const styles = useStyles();
  const color = useSemanticColors();
  const insets = useSafeAreaInsets();
  const {
    world,
    commands,
    layout,
    registry,
    mapRef,
    filterSheetRef,
    mapConfig,
    selectedCampus,
    layerState,
    now,
    canvasOverlays,
    stopShape,
    buildingCounts,
    chrome,
    taskHeader,
    onMarkerTap,
    handleOptionChanged,
    handleCameraChanged,
    handleCameraIdle,
    cameraCommand,
    scrollLocked,
    mapTouchHandlers,
    handleRootLayout,
    handleControlsLayout,
    handleSafeAreaChange,
    mapPadding,
    logoMargin,
    modalCardBottomGap,
    chips,
    narrowedChip,
    handleChipPress,
    chipMarkOf,
    handleChipClear,
    trackingMode,
    cameraBearing,
    permissionGranted,
    requestPermission,
    resetNorth,
    suggestion,
    locateStyle,
    handleSuggestionAccept,
    handleSuggestionDismiss,
    handleLocatePress,
    handleCampusPick,
    t,
    tpl,
  } = useMapHost({
    sheetViews,
    tabScope,
    tab,
    visibleMapCamera,
    launchAtUser,
    campusSuggestions,
    toolbar: toolbar !== undefined,
  });

  const handleLayersPress = () => {
    logCampusContentSelect({ content_type: 'filter_button', item_id: 'open' });
    filterSheetRef.current?.present?.();
  };
  // WHY: the layers button keeps its place whatever the chrome (ADR 0022 d1).
  const layersItem = {
    key: 'layers',
    icon: <StackSimpleIcon size={20} color={color.fg.neutralMuted} />,
    label: t('filter.layer'),
    onPress: handleLayersPress,
  };

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      {mapConfig && (
        <MapCanvas
          mapRef={mapRef}
          mapConfig={mapConfig}
          selectedCampus={selectedCampus}
          mapPadding={mapPadding}
          logoMargin={logoMargin}
          camera={cameraCommand}
          scrollLocked={scrollLocked}
          hiddenFromScreenReader={hiddenFromScreenReader}
          touchHandlers={mapTouchHandlers}
          onOptionChanged={handleOptionChanged}
          onCameraChanged={handleCameraChanged}
          onCameraIdle={handleCameraIdle}
          // WHY: one render behind the sheets, so a back's answer is not held up by markers.
          {...canvasOverlays}
          now={now}
          stopShape={stopShape}
          buildingCounts={buildingCounts}
          onMarkerTap={onMarkerTap}
        />
      )}

      {/* QUIRK(ios): UIKit glass mounted under an `entering` animation can render nothing until covered, so the new chrome appears at once and only the old one fades (MOTION-04). The column stays measured, so the visible map is padded by whatever is drawn. */}
      <View style={[styles.controlColumn, { top: insets.top + MAP_TOP_INSET_GAP }]} pointerEvents="box-none">
        {chrome === 'world' ? (
          <Animated.View
            key="world"
            exiting={FadeOut.duration(MAP_CHROME_FADE_MS)}
            style={styles.worldRows}
            pointerEvents="box-none"
            // WHY: on the chrome's own view, so every swap measures.
            onLayout={handleControlsLayout}
          >
            {mapConfig && (
              <View style={styles.controlRow} pointerEvents="box-none">
                {toolbar ? (
                  <>
                    <CampusToggle
                      campuses={mapConfig.campuses}
                      onPick={handleCampusPick}
                      height={MAP_TOOLBAR_HEIGHT}
                      glass={toolbar.glass}
                    />
                    <GlassButtonGroup
                      glass={toolbar.glass}
                      items={[
                        {
                          key: 'search',
                          icon: <MagnifyingGlassIcon size={20} color={color.fg.neutralMuted} />,
                          label: t('search.title'),
                          onPress: () => openSearch(tab),
                        },
                        layersItem,
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <CampusToggle campuses={mapConfig.campuses} onPick={handleCampusPick} />
                    <FilterButton onPress={handleLayersPress} />
                  </>
                )}
              </View>
            )}
            {mapConfig &&
              (narrowedChip ? (
                <ActiveChipStrip
                  chip={narrowedChip}
                  onClear={handleChipClear}
                  clearLabel={t('map.chip.clear')}
                />
              ) : (
                <CampusChipRow chips={chips} onPress={handleChipPress} markOf={chipMarkOf} />
              ))}
          </Animated.View>
        ) : chrome === 'taskField' ? (
          <Animated.View
            key="taskField"
            exiting={FadeOut.duration(MAP_CHROME_FADE_MS)}
            style={styles.controlRow}
            pointerEvents="box-none"
            onLayout={handleControlsLayout}
          >
            <TaskField
              title={taskHeader?.title ?? ''}
              onPress={() => openSearch(tab)}
              label={t('search.title')}
              glass={toolbar?.glass ?? false}
            />
            {toolbar ? (
              <GlassButtonGroup glass={toolbar.glass} items={[layersItem]} />
            ) : (
              <FilterButton onPress={handleLayersPress} />
            )}
          </Animated.View>
        ) : null}
      </View>

      {/* WHY: moved by `translateY` from `top: 0`, since a transform runs on the UI thread and animating `top` would round-trip through layout every frame. Rendered before the children so a sheet wins an overlap. */}
      <Animated.View style={[styles.lowerControlRow, locateStyle]} pointerEvents="box-none">
        {/* WHY: permission outranks any suggestion: with location refused the locate button is inert, so a campus card would be advice the user cannot act on. `null` is not yet checked, not refused. */}
        {permissionGranted === false ? (
          <CampusSuggestionCard
            message={t('map.campus.permission.message')}
            actionLabel={t('map.campus.permission.action')}
            onAccept={() => {
              logCampusContentSelect({ content_type: 'location_permission', item_id: 'accept' });
              void requestPermission();
            }}
          />
        ) : (
          suggestion && (
            <CampusSuggestionCard
              message={tpl(
                suggestion.variant === 'switch'
                  ? 'map.campus.suggest.switch'
                  : 'map.campus.suggest.show',
                suggestion.label,
              )}
              actionLabel={t(
                suggestion.variant === 'switch'
                  ? 'map.campus.suggest.actionSwitch'
                  : 'map.campus.suggest.actionShow',
              )}
              dismissLabel={t('map.campus.suggest.dismiss')}
              onAccept={handleSuggestionAccept}
              onDismiss={handleSuggestionDismiss}
            />
          )
        )}
        <View>
          {/* WHY: absolute against the button, so appearing with `Face` cannot nudge it, and it inherits the transform. */}
          {isFacing(trackingMode) && (
            <View style={styles.compassSlot}>
              <MapCompass
                bearing={cameraBearing}
                onPress={() => {
                  logCampusContentSelect({ content_type: 'compass', item_id: 'reset_north' });
                  resetNorth();
                }}
                label={t('map.compass')}
              />
            </View>
          )}
          <GlassIconButton
            label={isFacing(trackingMode) ? t('map.locate.face') : t('map.locate')}
            icon={
              isFacing(trackingMode) ? (
                <HeadingLocateIcon />
              ) : (
                <CrosshairSimpleIcon
                  size={20}
                  // QUIRK(naver-map): after a pan the SDK drops to NoFollow, so this greys out via onOptionChanged.
                  color={trackingMode === 'Follow' ? color.fg.brand : color.fg.neutralMuted}
                  weight={isTracking(trackingMode) ? 'bold' : 'regular'}
                />
              )
            }
            onPress={handleLocatePress}
          />
        </View>
      </Animated.View>

      <MapRegistryContext.Provider value={registry}>
        <MapCommandsContext.Provider value={commands}>
          <MapLayoutContext.Provider value={layout}>
            <MapWorldContext.Provider value={world}>{children}</MapWorldContext.Provider>
          </MapLayoutContext.Provider>
        </MapCommandsContext.Provider>
      </MapRegistryContext.Provider>

      {mapConfig && (
        <FilterSheet
          ref={filterSheetRef}
          mapConfig={mapConfig}
          layerState={layerState}
          bottomGap={modalCardBottomGap}
          now={now}
        />
      )}

      {/* QUIRK(android): `pointerEvents` reaches only a `ReactViewManager`, and `RNCSafeAreaProvider` is a `ViewGroupManager`, so the prop sits on a wrapping View; on the listener it is dropped and the full-screen view takes every touch. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SafeAreaListener style={StyleSheet.absoluteFill} onChange={handleSafeAreaChange} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  root: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  controlColumn: {
    position: 'absolute',
    left: MAP_SCREEN_GUTTER,
    right: MAP_SCREEN_GUTTER,
  },
  worldRows: {
    gap: MAP_TOP_ROW_GAP,
  },
  compassSlot: {
    position: 'absolute',
    right: 0,
    bottom: MAP_CONTROL_HEIGHT + 8,
  },
  lowerControlRow: {
    position: 'absolute',
    left: MAP_SCREEN_GUTTER,
    right: MAP_SCREEN_GUTTER,
    // WHY: the row's own height is what `translateY` subtracts, so it lands above the sheet.
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    // WHY: the lone locate button keeps its corner; the card's `flex: 1` claims the rest when shown.
    justifyContent: 'flex-end',
    gap: MAP_CONTROL_GAP,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SdsSpacing.x2,
  },
}));
