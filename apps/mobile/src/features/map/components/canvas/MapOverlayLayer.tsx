/**
 * WHY: layers share endpoints, so each renders only the overlays carrying its own `layerId`, or every building
 * shows twice. Overlays, not the SDK's clusterer, whose leaf takes only a coordinate, an image and a size: no
 * caption, tint or selected state. Not filtered by campus, so the buildings under the camera stay (ADR 0008).
 */

import React, { useCallback, useMemo } from 'react';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import {
  SdsPalette,
  wrapMarkerLabel,
} from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';

import { toCssColor } from './css-color.rules';
import { resolveMarkerGeometry } from './marker-shape.rules';
import { numberCircleLook, type BadgeKey } from './number-circle.rules';
import { MapZoneOverlay } from './MapZoneOverlay';
import { MapRouteOverlay } from './MapRouteOverlay';
import { useLayerOverlays } from '../../useLayerOverlays';
import { useWindowEdgeClock } from './useWindowEdgeClock';
import { resolvePinCollisions } from '../../pins.rules';
import { drawsWhenDimmed } from '../../sheet-lens.rules';
import type { MapLayerDef } from '../../map-config.types';
import type { MapOverlay, MarkerOverlay, MarkerTap } from '../../overlay.types';
import { useAppLanguage } from '../../useAppLanguage';
import { CAPTION_COLS, CAPTION_MAX_LINES, LABEL_Z_INDEX, NO_NATIVE_WRAP, NUMBER_CIRCLE_SIZE, NUMBER_CIRCLE_TEXT_RATIO, SELECTED_Z } from './marker.constants';

const MARKER_ICON = require('../../../../../assets/images/transparent_1x1.png');

/**
 * QUIRK(android): `setImage` has no equality guard, so an inline image literal would send ~100 markers back
 * through Fresco on every selection change. Module constants, never inline props.
 */
const PIN_IMAGE = { symbol: 'black' } as const;
/**
 * QUIRK(naver): the tint blends rather than replaces, so a black disc in a white ring serves every colour;
 * the transparent margin is the tap target (`DOT_CANVAS_RATIO`).
 */
const DOT_IMAGE = require('../../../../../assets/images/marker-dot.png');
/** WHY: no ring and no transparent margin, unlike `DOT_IMAGE`: the marker's `width`/`height` are the circle. */
const CIRCLE_IMAGE = require('../../../../../assets/images/marker-circle.png');

const BADGED_CIRCLE_IMAGES: Record<BadgeKey, number> = {
  '1': require('../../../../../assets/images/marker-circle-badge-1.png'),
  '2': require('../../../../../assets/images/marker-circle-badge-2.png'),
  '3': require('../../../../../assets/images/marker-circle-badge-3.png'),
  '4': require('../../../../../assets/images/marker-circle-badge-4.png'),
  '5': require('../../../../../assets/images/marker-circle-badge-5.png'),
  '6': require('../../../../../assets/images/marker-circle-badge-6.png'),
  '7': require('../../../../../assets/images/marker-circle-badge-7.png'),
  '8': require('../../../../../assets/images/marker-circle-badge-8.png'),
  '9': require('../../../../../assets/images/marker-circle-badge-9.png'),
  '9p': require('../../../../../assets/images/marker-circle-badge-9p.png'),
};
/**
 * CONTRACT(skkuverse-server): skkuverse-server/docs/reference/map-overlays-api.md §2.1: an untranslated name is
 * `''`, so `||`, not `??`. WHY: `zh` is read when a title carries one; Korean booths under Chinese layer labels
 * read worse.
 */
function pickText(text: MapOverlay['text'], lang: string): string {
  if (lang === 'en') return text.en || text.ko;
  if (lang === 'zh') return text.zh || text.ko;
  return text.ko;
}

/** WHY: `tap.placeId` equals `id` for an event marker, which a list row's select and `resolvePinCollisions` rely on. */
function placeIdOf(marker: MarkerOverlay): string {
  return marker.tap && marker.tap.kind !== 'chip' ? marker.tap.placeId : marker.id;
}

/**
 * WHY: memoised, which is required: the layer re-renders on every marker tap, and without it ~100 booths
 * rebuild their props and re-hash their captions. Every prop must stay a primitive or a stable reference.
 */
const PlaceMarker = React.memo(function PlaceMarker({
  lat,
  lng,
  label,
  layerStyle,
  isSelected,
  tap,
  onMarkerTap,
}: {
  lat: number;
  lng: number;
  label: string;
  layerStyle: MapLayerDef['style'];
  isSelected: boolean;
  tap: MarkerTap | null;
  onMarkerTap: (tap: MarkerTap) => void;
}) {
  const onTap = useCallback(() => {
    if (tap) onMarkerTap(tap);
  }, [tap, onMarkerTap]);

  const color = useSemanticColors();
  const geometry = resolveMarkerGeometry(layerStyle?.shape, isSelected, layerStyle);

  return (
    <NaverMapMarkerOverlay
      latitude={lat}
      longitude={lng}
      width={geometry.width}
      height={geometry.height}
      // WHY: the anchor moves with the shape; a teardrop hangs by its tip and a disc by its centre.
      anchor={{ x: 0.5, y: geometry.anchorY }}
      // QUIRK(android): both states are images, never React children; `ViewChangesTracker` re-rasterises every
      // custom-view marker every 40 ms, and a first capture can come out blank (mym0404/react-native-naver-map#120,
      // #143). Naver's tint blends, so a black source plus `tintColor` is the whole look.
      image={geometry.kind === 'pin' ? PIN_IMAGE : DOT_IMAGE}
      tintColor={toCssColor(layerStyle?.color, color.bg.dataBrand)}
      caption={{
        text: wrapMarkerLabel(label, CAPTION_COLS.placeDot, CAPTION_MAX_LINES),
        textSize: layerStyle?.captionTextSize ?? 9,
        requestedWidth: NO_NATIVE_WRAP,
      }}
      // EVIDENCE: the SDK hid a chip marker's caption on iOS with no other marker within ~60 m (checked 2026-09-24);
      // such a marker names an area, so its caption is forced on.
      //
      isHideCollidedCaptions={tap?.kind !== 'chip'}
      zIndex={isSelected ? SELECTED_Z : 0}
      minZoom={layerStyle?.minZoom}
      maxZoom={layerStyle?.maxZoom}
      onTap={tap ? onTap : undefined}
    />
  );
});

interface MapOverlayLayerProps {
  layer: MapLayerDef;
  buildingCounts?: ReadonlyMap<string, number>;
  /**
   * WHY: only the festival layers currently drawn. Building layers draw one building twice on purpose, which
   * the ladder would read as a tie, and a hidden layer must not suppress a visible one.
   */
  collisionPeers: ReadonlySet<string>;
  /**
   * WHY: passed down so the map holds one store subscription, not one per layer; it enters the collision ladder
   * as step 0 so the selected place is always drawn where the camera flies.
   */
  selectedPlaceId: string | null;
  onMarkerTap: (tap: MarkerTap) => void;
  /**
   * WHY: removed before the collision ladder, not after: a hidden night's pub left in would still win the
   * shared plot and leave the visible night's pub undrawn.
   */
  hiddenIds?: ReadonlySet<string>;
  /**
   * WHY: selection outranks visibility for this one place. Turning the layer on instead would write a resolved
   * value into `useMapStore`, freezing the schedule. Such a layer is outside `collisionPeers`.
   */
  onlyId?: string;
  dimmed?: boolean;
}

/**
 * WHY: memoised like `PlaceMarker`: a padding or one layer's visibility change re-renders the map, and every
 * other layer then skips. Its props are stable references.
 */
export const MapOverlayLayer = React.memo(function MapOverlayLayer({
  layer,
  collisionPeers,
  selectedPlaceId,
  onMarkerTap,
  hiddenIds,
  onlyId,
  dimmed = false,
  buildingCounts,
}: MapOverlayLayerProps) {
  const { data: overlays } = useLayerOverlays(layer.endpoint, true);
  const lang = useAppLanguage();
  const color = useSemanticColors();

  const all = useMemo(() => {
    const list = overlays ?? [];
    if (onlyId !== undefined) return list.filter((o) => o.id === onlyId);
    return hiddenIds && hiddenIds.size > 0 ? list.filter((o) => !hiddenIds.has(o.id)) : list;
  }, [overlays, hiddenIds, onlyId]);

  // WHY: the payload is identical either side of a boundary, so this hook owns the timer; it decides who wins
  // a shared coordinate, never what is hidden.
  const now = useWindowEdgeClock(all);

  const visible = useMemo(() => {
    const own = all.filter((o) => o.layerId === layer.id && (!dimmed || drawsWhenDimmed(o, layer)));
    if (!collisionPeers.has(layer.id)) return own;
    // WHY: resolve across every drawn peer first, then take this layer's share, or each layer keeps its own winner.
    // Markers only: two overlapping zones are an authoring choice, and a zone must never suppress a pin.
    //
    const peers = all.filter(
      (o): o is MarkerOverlay => o.kind === 'marker' && collisionPeers.has(o.layerId),
    );
    const drawn: ReadonlySet<MapOverlay> = new Set(
      resolvePinCollisions(peers, now, selectedPlaceId),
    );
    return own.filter((o) => o.kind !== 'marker' || drawn.has(o));
  }, [all, layer, dimmed, collisionPeers, now, selectedPlaceId]);

  if (!visible.length) return null;

  return (
    <>
      {visible.map((overlay) => {
        // WHY: an overlay `id` repeats across layers, since one building draws once per building layer.
        const key = `${layer.id}-${overlay.id}`;

        // WHY: no `default` arm: `mapOverlaysSchema` drops an unknown `kind` at the wire, and a new arm of
        // `MapOverlay` without a case here is a compile error below.
        //
        if (overlay.kind === 'polygon') {
          return (
            <MapZoneOverlay
              key={key}
              overlay={overlay}
              layerStyle={layer.style}
              onOverlayTap={onMarkerTap}
            />
          );
        }
        if (overlay.kind === 'path') {
          return (
            <MapRouteOverlay
              key={key}
              overlay={overlay}
              layerStyle={layer.style}
              onOverlayTap={onMarkerTap}
            />
          );
        }

        const marker: MarkerOverlay = overlay;
        const label = pickText(marker.text, lang);
        const onTap = marker.tap ? () => onMarkerTap(marker.tap!) : undefined;

        if (layer.markerStyle === 'textLabel') {
          return (
            <NaverMapMarkerOverlay
              key={key}
              latitude={marker.lat}
              longitude={marker.lng}
              width={1}
              height={1}
              image={MARKER_ICON}
              caption={{
                text: wrapMarkerLabel(
                  label,
                  CAPTION_COLS.textLabel,
                  CAPTION_MAX_LINES,
                ),
                textSize: layer.style?.captionTextSize ?? 7,
                color: dimmed ? color.fg.disabled : toCssColor(layer.style?.color, 'black'),
                requestedWidth: NO_NATIVE_WRAP,
              }}
              isHideCollidedCaptions
              globalZIndex={layer.style?.zIndex ?? LABEL_Z_INDEX}
              minZoom={layer.style?.minZoom}
              maxZoom={layer.style?.maxZoom}
              onTap={onTap}
            />
          );
        }

        if (layer.markerStyle === 'placeDot') {
          return (
            <PlaceMarker
              // WHY: no `label` and no `isSelected` in this key. With no React children there is no bitmap to re-capture,
              // the SDK re-applies the caption when its hash changes, and remounting would tear down a native overlay per tap.
              //
              key={key}
              lat={marker.lat}
              lng={marker.lng}
              label={label}
              layerStyle={layer.style}
              isSelected={selectedPlaceId !== null && placeIdOf(marker) === selectedPlaceId}
              tap={marker.tap}
              onMarkerTap={onMarkerTap}
            />
          );
        }

        const dotSize = layer.style?.size ?? NUMBER_CIRCLE_SIZE;
        const look = numberCircleLook(dotSize, buildingCounts?.get(marker.id));
        // EVIDENCE: ~60 numbers as child Views held the idle main thread near 100% on a Galaxy Note9 (Android 10,
        // debug build), about 14% as image plus caption. Every Android phone runs that loop; iOS has none.
        return (
          <NaverMapMarkerOverlay
            // WHY: no `label` in this key, as in the `placeDot` branch: no React children, and the SDK re-applies the caption.
            key={key}
            latitude={marker.lat}
            longitude={marker.lng}
            width={look.width}
            height={look.height}
            anchor={look.anchor}
            // QUIRK(android): the circle is an image and the number its caption, never a child View; `ViewChangesTracker`
            // redraws a child-View marker every 40 ms until it unmounts, and the library has no `tracksViewChanges` to
            // stop it. A count swaps in an untinted badged circle (`number-circle.rules.ts`).
            image={look.badge === null ? CIRCLE_IMAGE : BADGED_CIRCLE_IMAGES[look.badge]}
            tintColor={look.badge === null ? color.bg.dataBrand : undefined}
            caption={{
              // WHY: the number only; the building name is the `building_labels` layer's job.
              text: label,
              align: 'Center',
              // WHY: the map is light in both schemes.
              color: SdsPalette.static.white,
              textSize: Math.round(dotSize * NUMBER_CIRCLE_TEXT_RATIO),
              requestedWidth: NO_NATIVE_WRAP,
            }}
            // WHY: a number is part of its circle; hiding it on a collision would leave a blank dot.
            isHideCollidedCaptions={false}
            // WHY: the server gives this layer a higher floor than `building_labels`, so zooming out drops numbers before names.
            minZoom={layer.style?.minZoom}
            maxZoom={layer.style?.maxZoom}
            onTap={onTap}
          />
        );
      })}
    </>
  );
});
