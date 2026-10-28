import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  NaverMapArrowheadPathOverlay,
  NaverMapMarkerOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';
import {
  SdsPalette,
  type AppLanguage,
  type LatLng,
  SdsRadius,
} from '@skkuverse/shared';
import { arrowGapPt, cardPoints, fitCamera, metersPerPoint, trimPathEnd } from './boarding-map.rules';
import { useAppLanguage } from './components/useAppLanguage';
import { ColorSchemeProvider, Pressable, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { BoardingStop, StopMap } from '../transit.types';

const CARD_HEIGHT = 180;
const CAMERA_PADDING = 36;
// WHY: `ARROW_GAP_PT.marker` in `boarding-map.rules.ts` is sized to this circle.
const EXIT_SIZE = 16;
const PIN_WIDTH = 16;
const PIN_HEIGHT = 22;

const CIRCLE_IMAGE = require('../../../../assets/images/marker-circle.png');
/** QUIRK(android): an inline literal is a new image on every render. */
const PIN_IMAGE = { symbol: 'black' } as const;
const LAYER_GROUPS = {
  BUILDING: true,
  TRANSIT: true,
  BICYCLE: false,
  CADASTRAL: false,
  MOUNTAIN: false,
  TRAFFIC: false,
} as const;

const toCoord = ({ lat, lng }: LatLng) => ({ latitude: lat, longitude: lng });

interface BoardingMapCardProps {
  stop: BoardingStop & { coords: LatLng; map: StopMap };
  onPress: () => void;
  accessibilityLabel: string;
}

export function BoardingMapCard({ stop, onPress, accessibilityLabel }: BoardingMapCardProps) {
  const styles = useStyles();
  const lang = useAppLanguage();
  const [width, setWidth] = useState(0);

  const { coords, map } = stop;
  const camera =
    width > 0 ? fitCamera(cardPoints(coords, map), width, CARD_HEIGHT, CAMERA_PADDING) : null;
  const metersPerPt = camera ? metersPerPoint(camera.latitude, camera.zoom) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      bg="neutralWeak"
      style={styles.card}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {camera ? (
        // WHY: the map draws its light style in both schemes, so the marks on it read the light roles.
        <ColorSchemeProvider colorMode="light-only">
          <StillMap camera={camera} lang={lang} coords={coords} map={map} metersPerPt={metersPerPt} />
        </ColorSchemeProvider>
      ) : null}
    </Pressable>
  );
}

function StillMap({
  camera,
  lang,
  coords,
  map,
  metersPerPt,
}: {
  camera: NonNullable<ReturnType<typeof fitCamera>>;
  lang: AppLanguage;
  coords: LatLng;
  map: StopMap;
  metersPerPt: number;
}) {
  const color = useSemanticColors();
  return (
    // QUIRK(react-native): `pointerEvents` on a wrapping View, since a third-party native component may drop it.
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <NaverMapView
        style={StyleSheet.absoluteFill}
        // QUIRK(naver-map): `initialCamera` is read at mount only, so the map mounts after the first layout.
        initialCamera={camera}
        isShowZoomControls={false}
        isShowScaleBar={false}
        isShowCompass={false}
        isShowLocationButton={false}
        isScrollGesturesEnabled={false}
        isZoomGesturesEnabled={false}
        isTiltGesturesEnabled={false}
        isRotateGesturesEnabled={false}
        isStopGesturesEnabled={false}
        // QUIRK(android): a SurfaceView ignores its parents' clipping while they scroll.
        isUseTextureViewAndroid={Platform.OS === 'android'}
        isExtentBoundedInKorea
        mapType="Basic"
        locale={lang}
        layerGroups={LAYER_GROUPS}
      >
        {map.paths.map((p, i) => (
          <NaverMapArrowheadPathOverlay
            key={`path-${i}`}
            coords={trimPathEnd(p.points, arrowGapPt(p.to, map) * metersPerPt).map(toCoord)}
            width={4}
            // eslint-disable-next-line sds/role-placement -- a path overlay's `color` is the walk's paint, a data-color slot whose default is bg.dataBrand, as on every map route
            color={color.bg.dataBrand}
            outlineWidth={1}
            outlineColor={SdsPalette.static.white}
            headSizeRatio={2.5}
          />
        ))}
        {map.markers.map((m) => (
          <NaverMapMarkerOverlay
            key={m.id}
            latitude={m.coords.lat}
            longitude={m.coords.lng}
            width={EXIT_SIZE}
            height={EXIT_SIZE}
            anchor={{ x: 0.5, y: 0.5 }}
            image={CIRCLE_IMAGE}
            tintColor={color.bg.neutralSolid}
            caption={{
              text: String(m.number),
              align: 'Center',
              color: SdsPalette.static.white,
              haloColor: 'transparent',
              textSize: 9,
            }}
            isHideCollidedCaptions={false}
          />
        ))}
        <NaverMapMarkerOverlay
          latitude={coords.lat}
          longitude={coords.lng}
          width={PIN_WIDTH}
          height={PIN_HEIGHT}
          anchor={{ x: 0.5, y: 1 }}
          image={PIN_IMAGE}
          tintColor={color.bg.dataBrand}
        />
      </NaverMapView>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  card: {
    height: CARD_HEIGHT,
    borderRadius: SdsRadius.r3,
    overflow: 'hidden',
  },
}));
