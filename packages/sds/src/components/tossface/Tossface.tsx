/**
 * QUIRK(android): Tossface glyphs are 128px bitmaps in a 112ppem strike, about 1.14 em tall over a declared ascent of 0.99 em, and a TextView
 * clips to its bounds, so the top ~0.15 em was cut off. The text grows upward by `room` (a top padding with an equal negative margin), so its
 * layout box stays where it was. iOS draws past a label's bounds and is left untouched.
 */
import React, { forwardRef, type ReactNode } from 'react';
import {
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

/** WHY: the family name the app registers the font under through the expo-font plugin. */
export const TOSSFACE_FONT_FAMILY = 'TossFaceFontMac';

/** QUIRK(react-native): the default font size, for a style that names none. */
const DEFAULT_FONT_SIZE = 14;

/** WHY: the ≈0.15 em overhang plus margin for call sites whose `lineHeight` is tighter than the font's natural 1.25 em, which Android takes out of the ascent. */
const HEADROOM_EM = 0.2;

function numeric(value: TextStyle['marginTop']): number {
  return typeof value === 'number' ? value : 0;
}

/** WHY: put it after the caller's style; the compensation adds to a top padding or margin there rather than replacing it. */
export function tossfaceStyle(style?: StyleProp<TextStyle>): TextStyle {
  if (Platform.OS !== 'android') return { fontFamily: TOSSFACE_FONT_FAMILY };
  const flat = StyleSheet.flatten(style) ?? {};
  // WHY: whole device pixels, so the padding and the negative margin round alike and the glyph does not move.
  const room = PixelRatio.roundToNearestPixel(
    Math.ceil((flat.fontSize ?? DEFAULT_FONT_SIZE) * HEADROOM_EM),
  );
  return {
    fontFamily: TOSSFACE_FONT_FAMILY,
    paddingTop: numeric(flat.paddingTop ?? flat.paddingVertical ?? flat.padding) + room,
    marginTop: numeric(flat.marginTop ?? flat.marginVertical ?? flat.margin) - room,
  };
}

export type TossfaceProps = TextProps & {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
};

export const Tossface = forwardRef<Text, TossfaceProps>(function Tossface(
  { size, style, ...rest },
  ref,
) {
  const sized = size == null ? style : [style, { fontSize: size }];
  return <Text ref={ref} {...rest} style={[sized, tossfaceStyle(sized)]} />;
});
