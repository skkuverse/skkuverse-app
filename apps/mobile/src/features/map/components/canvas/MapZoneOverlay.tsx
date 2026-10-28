/**
 * QUIRK(naver-map): `NaverMapPolygonOverlay` defaults `color` to opaque black and `outlineWidth` to 0, so an
 * unstyled zone is a black rectangle over its booths; the fallbacks below assume nothing arrives.
 */

import { useCallback, useMemo } from 'react';
import { useSemanticColors } from '@skkuverse/sds';
import { NaverMapPolygonOverlay } from '@mj-studio/react-native-naver-map';

import { toCssColor } from './css-color.rules';
import { toPolygonGeometry, withAlpha } from './overlay-geometry.rules';
import type { MapLayerDef } from '../../map-config.types';
import type { MapOverlay, MarkerTap } from '../../overlay.types';

interface MapZoneOverlayProps {
  overlay: Extract<MapOverlay, { kind: 'polygon' }>;
  layerStyle: MapLayerDef['style'];
  onOverlayTap: (tap: MarkerTap) => void;
}

export function MapZoneOverlay({ overlay, layerStyle, onOverlayTap }: MapZoneOverlayProps) {
  const color = useSemanticColors();
  const geometry = useMemo(() => toPolygonGeometry(overlay.rings), [overlay.rings]);

  const tap = overlay.tap;
  const onTap = useCallback(() => {
    if (tap) onOverlayTap(tap);
  }, [tap, onOverlayTap]);

  if (!geometry) return null;

  // WHY: `color` is the fill here and the tint on a marker layer, resolved by what is drawn.
  const fill = withAlpha(toCssColor(layerStyle?.color, color.bg.dataBrand), layerStyle?.fillOpacity);

  return (
    <NaverMapPolygonOverlay
      coords={geometry.coords}
      holes={geometry.holes}
      color={fill}
      // WHY: the outline falls back to the fill colour at full strength; campus geometry sends no outline, since
      // its colour belongs to a token that resolves per theme.
      outlineColor={toCssColor(layerStyle?.outlineColor, toCssColor(layerStyle?.color, color.bg.dataBrand))}
      outlineWidth={layerStyle?.outlineWidth}
      // QUIRK(naver-map): undefined is the SDK's own "no bound", so an unstyled layer draws at every zoom.
      minZoom={layerStyle?.minZoom}
      maxZoom={layerStyle?.maxZoom}
      // WHY: `tap: null` is a backdrop; a handler would make the outline swallow taps meant for markers inside it.
      onTap={tap ? onTap : undefined}
    />
  );
}
