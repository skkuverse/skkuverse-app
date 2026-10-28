/**
 * WHY: the beam overlays the idle crosshair, so both states read as one button; its mouth is inset and closed
 * with an arc, since clipping at the circle pinches it to nothing. The beam never rotates: in `Face` mode
 * the SDK already turns the map so the heading points up.
 */

import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { CrosshairSimpleIcon } from 'phosphor-react-native';
import { useSemanticColors } from '@skkuverse/sds';

const BOX = 40;
const CENTRE = BOX / 2;
/** WHY: matches the idle state's crosshair, so the glyph does not resize between states. */
const GLYPH = 20;

const MOUTH_Y = 7;
const MOUTH_HALF_WIDTH = 9;
/** WHY: larger than the mouth's half-width, so the arc is a gentle bow. */
const MOUTH_ARC_R = 20;
const BEAM = [
  `M ${CENTRE} ${CENTRE}`,
  `L ${CENTRE - MOUTH_HALF_WIDTH} ${MOUTH_Y}`,
  `A ${MOUTH_ARC_R} ${MOUTH_ARC_R} 0 0 1 ${CENTRE + MOUTH_HALF_WIDTH} ${MOUTH_Y}`,
  'Z',
].join(' ');

export function HeadingLocateIcon() {
  const color = useSemanticColors();
  return (
    <View style={styles.root}>
      <CrosshairSimpleIcon size={GLYPH} color={color.fg.brand} weight="bold" />
      <Svg
        width={BOX}
        height={BOX}
        viewBox={`0 0 ${BOX} ${BOX}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="headingBeam" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.fg.brand} stopOpacity={0.15} />
            <Stop offset="1" stopColor={color.fg.brand} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path d={BEAM} fill="url(#headingBeam)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
