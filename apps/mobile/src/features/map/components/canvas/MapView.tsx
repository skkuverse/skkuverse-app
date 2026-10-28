import { forwardRef, useMemo } from 'react';
import {
  NaverMapView,
  type Camera,
  type LocationTrackingMode,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import {
  Platform,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ColorSchemeProvider } from '@skkuverse/sds';
import type { LogoMargin, MapPadding } from '../../camera-move.rules';
import type { MapConfig } from '../../map-config.types';
import { useAppLanguage } from '../../useAppLanguage';
import { MIN_CAMERA_ZOOM } from '../../camera.constants';
import { toInitialCamera } from '../../camera-targets.rules';
import type { Campus } from '@skkuverse/shared';

interface MapViewProps {
  mapConfig: MapConfig;
  selectedCampus: Campus;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /**
   * QUIRK(naver-map): the camera's coordinate becomes the centre of the view minus this padding, so a move or
   * fit lands in the visible map (iOS `setContentInset:`, Android `setContentPadding` in dp).
   */
  mapPadding?: MapPadding;
  logoMargin?: LogoMargin;
  onTapMap?: () => void;
  /**
   * QUIRK(naver-map): also fires on the SDK's silent downgrade to `NoFollow` on any camera move, which the locate
   * button mirrors (`useLocationTracking`).
   */
  onOptionChanged?: (params: { locationTrackingMode: LocationTrackingMode }) => void;
  onCameraChanged?: (params: Camera) => void;
  /** QUIRK(naver-map): fires only once a gesture or animation has fully ended, unlike `onCameraChanged`. */
  onCameraIdle?: (params: Camera) => void;
  /** WHY: a one-shot order, not controlled state; it is the only route to the camera's bearing. */
  camera?: Camera;
  scrollLocked: boolean;
  /** WHY: set on the map view itself, so a screen reader neither adds a native view nor reparents the map. */
  hiddenFromScreenReader?: boolean;
  onTouchStart?: (e: GestureResponderEvent) => void;
  onTouchMove?: (e: GestureResponderEvent) => void;
  onTouchEnd?: (e: GestureResponderEvent) => void;
  onTouchCancel?: (e: GestureResponderEvent) => void;
}

/**
 * QUIRK(naver-map): iOS applies every field of the stub the library sends with no overlay, zeroing the anchors
 * (mym0404/react-native-naver-map#172, fixed only for a passed overlay). A module constant: the native side
 * re-applies all of it, `isVisible` included, on any change by value. Android is sent nothing.
 */
const IOS_LOCATION_OVERLAY = {
  anchor: { x: 0.5, y: 0.5 },
  subAnchor: { x: 0.5, y: 1 },
  circleOutlineWidth: 0,
};

const LAYER_GROUPS = {
  BUILDING: true,
  TRANSIT: true,
  BICYCLE: false,
  CADASTRAL: false,
  MOUNTAIN: false,
  TRAFFIC: false,
} as const;

export const MapView = forwardRef<NaverMapViewRef, MapViewProps>(
  function MapView(
    {
      mapConfig,
      selectedCampus,
      style,
      children,
      mapPadding,
      logoMargin,
      onTapMap,
      onOptionChanged,
      onCameraChanged,
      onCameraIdle,
      camera,
      scrollLocked,
      hiddenFromScreenReader = false,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
    ref,
  ) {
    const lang = useAppLanguage();
    const initialCamera = useMemo(
      () => toInitialCamera(mapConfig.campuses, selectedCampus),
      // WHY: computed once; the camera moves via the ref after the first render.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the initial camera only; later moves go through the ref
      [],
    );

    return (
      <NaverMapView
        ref={ref}
        style={style}
        initialCamera={initialCamera}
        isShowZoomControls={false}
        isShowScaleBar={false}
        // QUIRK(naver-map): the SDK's compass cannot be positioned, so `MapCompass` draws one above the locate button.
        isShowCompass={false}
        // QUIRK(naver-map): NAVER's terms require the logo seen; the SDK lays it out inside `mapPadding`, margin floored
        // at 9pt top and 12pt side, so the host pads only to the logo's corner (`sdkMapPadding`, `logoMarginOf`).
        logoAlign="TopLeft"
        {...(logoMargin && { logoMargin })}
        isScrollGesturesEnabled={!scrollLocked}
        locationOverlay={Platform.OS === 'ios' ? IOS_LOCATION_OVERLAY : undefined}
        isExtentBoundedInKorea
        minZoom={MIN_CAMERA_ZOOM}
        {...(mapPadding && { mapPadding })}
        mapType="Basic"
        locale={lang}
        layerGroups={LAYER_GROUPS}
        {...(mapConfig.naver.styleId && {
          customStyleId: mapConfig.naver.styleId,
        })}
        onTapMap={onTapMap}
        onOptionChanged={onOptionChanged}
        onCameraChanged={onCameraChanged}
        onCameraIdle={onCameraIdle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        {...(camera && { camera })}
        {...(hiddenFromScreenReader && {
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants' as const,
        })}
      >
        {/* WHY: the map is light in both schemes, so overlays read their colours in light; a context adds no native view. */}
        <ColorSchemeProvider colorMode="light-only">{children}</ColorSchemeProvider>
      </NaverMapView>
    );
  },
);

export type { NaverMapViewRef };
