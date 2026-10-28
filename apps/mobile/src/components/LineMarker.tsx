import { StyleSheet, View } from 'react-native';
import { hexToColor, legibleOn, SdsRadius, SdsSpacing, SdsTypeScale } from '@skkuverse/shared';
import { Txt, useResolvedScheme, useSemanticColors } from '@skkuverse/sds';

/** WHY: the height of the badges beside it in a title row. */
const SIZE = SdsSpacing.x4_5;

const STROKE = 1.5;

/**
 * QUIRK(react-native): as a flex child the text is cut to the ring's inner box (15pt), shorter than the
 * `t1` line (16.5pt), and sits low; its full line box centred by hand puts WantedSans on the ring's centre.
 */
const LINE = SdsTypeScale.t1.lineHeight;

interface LineMarkerProps {
  text: string;
  color: string;
}

export function LineMarker({ text, color }: LineMarkerProps) {
  const semantic = useSemanticColors();
  const scheme = useResolvedScheme();
  const served = hexToColor(color, semantic.bg.dataBrand);
  // WHY: the server's colour is for a light row; on a dark one it is lifted toward white, hue kept, to 4.5:1.
  const ink = scheme === 'dark' ? legibleOn(served, semantic.bg.layerDefault) : served;

  return (
    <View style={[styles.circle, { borderColor: ink }]}>
      <Txt typography="t1" fontWeight="bold" style={[styles.text, { color: ink }]}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SdsRadius.full,
    borderWidth: STROKE,
  },
  text: {
    // QUIRK(react-native): an absolute child is placed in the padding box, inside the border.
    position: 'absolute',
    left: 0,
    right: 0,
    top: (SIZE - 2 * STROKE - LINE) / 2,
    height: LINE,
    textAlign: 'center',
  },
});
