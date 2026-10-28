/**
 * WHY: drawn in SVG, not shipped as bitmaps; the shapes are deliberately not SKKU's campus, since a
 * recognisable-but-wrong campus reads as a bug.
 */

import Svg, { Path, Rect } from 'react-native-svg';

const THUMB = {
  land: '#F1F3F0',
  park: '#D9EAD3',
  water: '#BFDCF5',
  roadMajor: '#FFD9A0',
  roadMinor: '#FFFFFF',
  block: '#E3E7E3',
};

export function MapThumb() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Rect x={0} y={0} width={100} height={100} fill={THUMB.land} />

      <Path d="M-6,-6 C22,-8 40,10 34,28 C28,44 6,48 -6,38 Z" fill={THUMB.park} />

      <Rect x={58} y={10} width={16} height={13} rx={2} fill={THUMB.block} />
      <Rect x={79} y={10} width={18} height={13} rx={2} fill={THUMB.block} />
      <Rect x={58} y={82} width={20} height={16} rx={2} fill={THUMB.block} />

      <Path
        d="M-4,54 C18,46 34,64 54,57 C72,51 86,61 104,54 L104,72 C86,79 72,69 54,75 C34,82 18,64 -4,72 Z"
        fill={THUMB.water}
      />

      {/* WHY: stroked, not filled, so contrast does the work at 64pt. */}
      <Path d="M-4,32 C28,27 62,36 104,29" stroke={THUMB.roadMajor} strokeWidth={7} fill="none" />
      <Path d="M26,-4 L33,52" stroke={THUMB.roadMinor} strokeWidth={4} fill="none" />
      <Path d="M-4,88 C26,84 62,92 104,86" stroke={THUMB.roadMinor} strokeWidth={4} fill="none" />
    </Svg>
  );
}
