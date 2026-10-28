/**
 * QUIRK(naver-map): the SDK wants the opposite of RFC 7946 winding, which the server guarantees
 * (skkuverse-server `src/shared/ring-winding.util.ts`), so every ring is reversed, never measured: a wrongly
 * wound ring still draws and silently refuses taps. Here, not in shared, as one library's convention.
 */

import type { Coord } from '@mj-studio/react-native-naver-map';
import type { LatLng } from '@skkuverse/shared';

export function toNaverCoords(points: readonly LatLng[]): Coord[] {
  return points.map(({ lat, lng }) => ({ latitude: lat, longitude: lng }));
}

/**
 * WHY: one reversal serves exterior and holes, since the two conventions mirror each other. `null` keeps
 * "nothing to draw" explicit; the SDK silently skips an empty `coords`.
 */
export function toPolygonGeometry(
  rings: readonly LatLng[][],
): { coords: Coord[]; holes: Coord[][] } | null {
  const [outer, ...holes] = rings;
  if (!outer) return null;
  // WHY: `.reverse()` mutates, which is safe because `toNaverCoords` returns a fresh array.
  return {
    coords: toNaverCoords(outer).reverse(),
    holes: holes.map((ring) => toNaverCoords(ring).reverse()),
  };
}

const RGB_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * QUIRK(naver-map): `NaverMapPolygonOverlay.color` defaults to opaque black. WHY: composed onto the string, not
 * parsed into channels; anything this cannot decompose returns unchanged, and an absent opacity leaves the
 * colour alone.
 */
export function withAlpha(css: string, opacity: number | undefined): string {
  if (opacity === undefined || !Number.isFinite(opacity)) return css;
  const match = RGB_HEX_RE.exec(css);
  if (!match) return css;

  const digits = match[1]!;
  // WHY: appending two digits to `#abc` would produce `#RGBA`, changing the colour as well as its opacity.
  const rgb =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;

  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${alpha}`;
}
