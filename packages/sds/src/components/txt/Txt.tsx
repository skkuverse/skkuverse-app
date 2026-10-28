import React, { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { WANTED_SANS, resolveWantedSansFace } from '@skkuverse/shared';
import { useSemanticColors } from '../../core/theme';
import { useTypographyTheme } from '../../core/TypographyProvider';
import { fontWeightMap, type FontWeightKeys, type TypographyKeys } from '../../foundation/typography';
import { resolveTxtColor, type TxtColor } from './txtColor';

export interface TxtStyleProps {
  typography?: TypographyKeys;
  fontWeight?: FontWeightKeys;
  color?: TxtColor;
  numberOfLines?: number;
  textAlign?: TextStyle['textAlign'];
}

export type TxtOwnedStyleKey = 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontFamily' | 'fontWeight';

export type TxtStyle = Omit<TextStyle, TxtOwnedStyleKey> & { [K in TxtOwnedStyleKey]?: never };

export type TxtProps = TxtStyleProps &
  Omit<ComponentProps<typeof Text>, 'style'> & {
    children: ReactNode;
    style?: StyleProp<TxtStyle>;
  };

export function toFontWeightStyle(fontWeightKey: FontWeightKeys): Pick<TextStyle, 'fontWeight'> {
  return { fontWeight: fontWeightMap[fontWeightKey] };
}

/**
 * QUIRK(android): a font loads only by file name, so the face is picked from the final style, after the caller's `fontWeight`;
 * an earlier pick falls back to the system font (packages/shared/src/tokens/fontFace.ts).
 */
function withAndroidFace(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (Platform.OS !== 'android') return style;
  const face = resolveWantedSansFace(Platform.OS, StyleSheet.flatten(style));
  return face ? [style, face] : style;
}

const Txt = forwardRef<Text, TxtProps>(function Txt(
  {
    typography = 't7',
    fontWeight = 'regular',
    color,
    numberOfLines,
    textAlign,
    style,
    children,
    ...restProps
  },
  ref,
) {
  const semantic = useSemanticColors();
  const { typography: typographyTheme } = useTypographyTheme();

  const resolvedColor = resolveTxtColor(color, semantic.fg);
  const typo = typographyTheme[typography];

  return (
    <Text
      ref={ref}
      allowFontScaling={false}
      style={withAndroidFace([
        styles.base,
        typo,
        { color: resolvedColor, textAlign },
        toFontWeightStyle(fontWeight),
        style,
      ])}
      numberOfLines={numberOfLines}
      {...restProps}
    >
      {children}
    </Text>
  );
});

const styles = StyleSheet.create({
  base: {
    fontFamily: WANTED_SANS,
    includeFontPadding: false,
  },
});

export default Txt;
export { Txt };
