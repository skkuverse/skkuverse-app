import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SdsSpacing, type FgColorName } from '@skkuverse/shared';
import { Pressable } from '../pressable';
import { Txt, type TxtStyle } from '../txt';
import type { FontWeightKeys, TypographyKeys } from '../../foundation/typography';

export interface ListHeaderProps {
  title: ReactNode;
  upper?: ReactNode;
  right?: ReactNode;
  lower?: ReactNode;
  titleViewStyle?: StyleProp<ViewStyle>;
  rightViewStyle?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

function ListHeaderRoot({
  title,
  upper,
  right,
  lower,
  titleViewStyle,
  rightViewStyle,
  onPress,
  style,
}: ListHeaderProps) {
  const content = (
    <View style={[styles.container, style]}>
      {upper != null && <View style={styles.upper}>{upper}</View>}
      <View style={styles.titleRow}>
        <View style={[styles.titleSlot, titleViewStyle]}>{title}</View>
        {right != null && <View style={[styles.rightSlot, rightViewStyle]}>{right}</View>}
      </View>
      {lower != null && <View style={styles.lower}>{lower}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} scaleScope="content">
        {content}
      </Pressable>
    );
  }

  return content;
}

interface TitleParagraphProps {
  children: ReactNode;
  typography?: TypographyKeys;
  fontWeight?: FontWeightKeys;
  color?: FgColorName;
  numberOfLines?: number;
  style?: StyleProp<TxtStyle>;
}

function TitleParagraph({
  children,
  typography = 't7',
  fontWeight = 'regular',
  color,
  numberOfLines,
  style,
}: TitleParagraphProps) {
  return (
    <Txt
      typography={typography}
      fontWeight={fontWeight}
      color={color ?? 'neutral'}
      numberOfLines={numberOfLines}
      style={style}
    >
      {children}
    </Txt>
  );
}

interface RightTextProps {
  children: ReactNode;
  /** WHY: TDS draws a header's right text only at t3 (13px) or t5 (15px). */
  typography?: TypographyKeys;
  color?: FgColorName;
  style?: StyleProp<TxtStyle>;
}

function RightText({ children, typography = 't3', color, style }: RightTextProps) {
  return (
    <Txt
      typography={typography}
      fontWeight="regular"
      color={color ?? 'neutralMuted'}
      style={style}
    >
      {children}
    </Txt>
  );
}

interface RightArrowProps {
  children: ReactNode;
  /** WHY: TDS draws a header's right text only at t3 (13px) or t5 (15px). */
  typography?: TypographyKeys;
  color?: FgColorName;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
}

function RightArrow({ children, typography = 't3', color, onPress, style }: RightArrowProps) {
  const resolvedColor = color ?? 'neutralMuted';

  const content = (
    <View style={[styles.rightArrowContainer, style]}>
      <Txt typography={typography} fontWeight="regular" color={resolvedColor}>
        {children}
      </Txt>
      <Txt typography={typography} fontWeight="regular" color={resolvedColor} style={styles.arrowIcon}>
        {' ›'}
      </Txt>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

interface DescriptionParagraphProps {
  children: ReactNode;
  typography?: TypographyKeys;
  fontWeight?: FontWeightKeys;
  color?: FgColorName;
  numberOfLines?: number;
  style?: StyleProp<TxtStyle>;
}

function DescriptionParagraph({
  children,
  typography = 't3',
  fontWeight = 'regular',
  color,
  numberOfLines,
  style,
}: DescriptionParagraphProps) {
  return (
    <Txt
      typography={typography}
      fontWeight={fontWeight}
      color={color ?? 'neutralSubtle'}
      numberOfLines={numberOfLines}
      style={style}
    >
      {children}
    </Txt>
  );
}

export const ListHeader = Object.assign(ListHeaderRoot, {
  TitleParagraph,
  RightText,
  RightArrow,
  DescriptionParagraph,
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SdsSpacing.x6,
    paddingVertical: SdsSpacing.x4,
  },
  upper: {
    marginBottom: SdsSpacing.x1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleSlot: {
    flex: 1,
  },
  rightSlot: {
    marginLeft: SdsSpacing.x2,
  },
  lower: {
    marginTop: SdsSpacing.x1,
  },
  rightArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    marginLeft: SdsSpacing.x0_5,
  },
});
