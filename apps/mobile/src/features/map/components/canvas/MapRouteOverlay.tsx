/**
 * WHY: `NaverMapPathOverlay`, not the polyline overlay: its outline keeps a coloured line legible over
 * satellite. A dashed line arrives as its own `polyline` kind and gets its own component.
 */

import { useCallback, useMemo } from 'react';
import { useSemanticColors } from '@skkuverse/sds';
import { NaverMapPathOverlay } from '@mj-studio/react-native-naver-map';

import { toCssColor } from './css-color.rules';
import { toNaverCoords } from './overlay-geometry.rules';
import type { MapLayerDef } from '../../map-config.types';
import type { MapOverlay, MarkerTap } from '../../overlay.types';
import { DEFAULT_STROKE } from './marker.constants';

interface MapRouteOverlayProps {
  overlay: Extract<MapOverlay, { kind: 'path' }>;
  layerStyle: MapLayerDef['style'];
  onOverlayTap: (tap: MarkerTap) => void;
}

export function MapRouteOverlay({ overlay, layerStyle, onOverlayTap }: MapRouteOverlayProps) {
  const color = useSemanticColors();
  const coords = useMemo(() => toNaverCoords(overlay.line), [overlay.line]);

  const tap = overlay.tap;
  const onTap = useCallback(() => {
    if (tap) onOverlayTap(tap);
  }, [tap, onOverlayTap]);

  return (
    <NaverMapPathOverlay
      coords={coords}
      width={layerStyle?.width ?? DEFAULT_STROKE}
      color={toCssColor(layerStyle?.color, color.bg.dataBrand)}
      outlineWidth={layerStyle?.outlineWidth}
      outlineColor={toCssColor(layerStyle?.outlineColor, 'transparent')}
      minZoom={layerStyle?.minZoom}
      maxZoom={layerStyle?.maxZoom}
      onTap={tap ? onTap : undefined}
    />
  );
}
