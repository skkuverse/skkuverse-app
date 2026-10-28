/**
 * QUIRK(naver): the SDK resets a marker's alpha to 1 whenever its image loads, so a lens change pops when the
 * sheet settles rather than fading. Every marker is an image, a tint and captions, never React children; a look
 * laid out at runtime takes a library patch that stops `ViewChangesTracker` after its first non-blank capture.
 */

import { memo, useCallback } from 'react';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import { markerLabelColumns, pickI18nText, wrapMarkerLabel } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import type { MarkerTap } from '../../overlay.types';
import type { TaskOverlay } from '../../sheet-stack.types';
import { useAppLanguage } from '../../useAppLanguage';
import { MapRouteOverlay } from './MapRouteOverlay';
import { MapZoneOverlay } from './MapZoneOverlay';
import { toCssColor } from './css-color.rules';
import { directionLabelAnchor, stopMarkerLook, type StopMarkerShape, directionLabelWidth } from './task-marker.rules';
import { BUS_STOP_PIN, FOCUSED_CAPTION_SIZE, LABEL_BOX, STOP_CAPTION_SIZE, LABEL_GLOBAL_Z, TIP_ANCHOR, CAPTION_COLS, CAPTION_MAX_LINES, NO_NATIVE_WRAP, SELECTED_Z } from './marker.constants';

// QUIRK(android): `setImage` has no equality guard, so a fresh source each render reloads every pin.
const STOP_IMAGE = require('../../../../../assets/images/marker-bus-stop.png');
const ROUTE_STOP_DOT_IMAGE = require('../../../../../assets/images/marker-route-stop-dot.png');
const STOP_IMAGES = { stopPin: STOP_IMAGE, routeStopDot: ROUTE_STOP_DOT_IMAGE } as const;
const FOCUSED_IMAGE = require('../../../../../assets/images/marker-bus-stop-pin.png');
const LABEL_IMAGE = require('../../../../../assets/images/marker-label-box.png');


interface MarkerProps {
  lat: number;
  lng: number;
  label: string;
}

const StopMarker = memo(function StopMarker({
  lat,
  lng,
  label,
  shape,
  routeColor,
  tap,
  onMarkerTap,
}: MarkerProps & {
  shape: StopMarkerShape;
  routeColor: string | undefined;
  tap: MarkerTap | null;
  onMarkerTap: (tap: MarkerTap) => void;
}) {
  const color = useSemanticColors();
  const look = stopMarkerLook(shape);
  const onTap = useCallback(() => {
    if (tap) onMarkerTap(tap);
  }, [tap, onMarkerTap]);
  return (
    <NaverMapMarkerOverlay
      latitude={lat}
      longitude={lng}
      width={look.size}
      height={look.size}
      anchor={look.anchor}
      image={STOP_IMAGES[look.image]}
      tintColor={look.tint === 'route' ? toCssColor(routeColor, color.bg.dataStop) : color.bg.dataStop}
      caption={look.captioned ? stopCaption(label, STOP_CAPTION_SIZE) : undefined}
      isHideCollidedCaptions
      onTap={tap ? onTap : undefined}
    />
  );
});

const FocusedStopMarker = memo(function FocusedStopMarker({ lat, lng, label }: MarkerProps) {
  const color = useSemanticColors();
  return (
    <NaverMapMarkerOverlay
      latitude={lat}
      longitude={lng}
      width={BUS_STOP_PIN.width}
      height={BUS_STOP_PIN.height}
      anchor={TIP_ANCHOR}
      image={FOCUSED_IMAGE}
      tintColor={color.bg.dataStop}
      caption={stopCaption(label, FOCUSED_CAPTION_SIZE)}
      isHideCollidedCaptions={false}
      zIndex={SELECTED_Z}
    />
  );
});

const DirectionLabel = memo(function DirectionLabel({ lat, lng, label, shape }: MarkerProps & { shape: StopMarkerShape }) {
  const color = useSemanticColors();
  return (
    <NaverMapMarkerOverlay
      latitude={lat}
      longitude={lng}
      width={directionLabelWidth(markerLabelColumns(label))}
      height={LABEL_BOX.height}
      anchor={directionLabelAnchor(shape)}
      image={LABEL_IMAGE}
      caption={{
        text: label,
        align: 'Center',
        textSize: LABEL_BOX.textSize,
        color: color.fg.neutral,
        requestedWidth: NO_NATIVE_WRAP,
      }}
      isHideCollidedCaptions={false}
      globalZIndex={LABEL_GLOBAL_Z}
    />
  );
});

/** WHY: the SDK's own wrapper breaks only at spaces. */
function stopCaption(text: string, textSize: number) {
  return {
    text: wrapMarkerLabel(text, CAPTION_COLS.placeDot, CAPTION_MAX_LINES),
    textSize,
    requestedWidth: NO_NATIVE_WRAP,
  };
}

interface MapTaskOverlaysProps {
  overlays: readonly TaskOverlay[];
  stopShape: StopMarkerShape;
  onMarkerTap: (tap: MarkerTap) => void;
}

export const MapTaskOverlays = memo(function MapTaskOverlays({ overlays, stopShape, onMarkerTap }: MapTaskOverlaysProps) {
  const lang = useAppLanguage();
  return (
    <>
      {overlays.map((overlay) => {
        const key = `${overlay.layerId}-${overlay.id}`;
        if (overlay.kind === 'polygon') {
          return <MapZoneOverlay key={key} overlay={overlay} layerStyle={undefined} onOverlayTap={onMarkerTap} />;
        }
        if (overlay.kind === 'path') {
          return <MapRouteOverlay key={key} overlay={overlay} layerStyle={undefined} onOverlayTap={onMarkerTap} />;
        }
        const label = pickI18nText(overlay.text, lang);
        switch (overlay.role) {
          case 'stop':
            return (
              <StopMarker
                key={key}
                lat={overlay.lat}
                lng={overlay.lng}
                label={label}
                shape={stopShape}
                routeColor={overlay.color}
                tap={overlay.tap}
                onMarkerTap={onMarkerTap}
              />
            );
          case 'focusedPlace':
            return <FocusedStopMarker key={key} lat={overlay.lat} lng={overlay.lng} label={label} />;
          case 'directionLabel':
            return <DirectionLabel key={key} lat={overlay.lat} lng={overlay.lng} label={label} shape={stopShape} />;
        }
      })}
    </>
  );
});
