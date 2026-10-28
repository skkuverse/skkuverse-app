import React, { type ReactNode } from 'react';
import type { BgColorName, FgColorName, SdsColor, SemanticColors } from '@skkuverse/shared';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createRecipe } from '../../core/createRecipe';
import { useSemanticColors } from '../../core/theme';
import type { FontWeightKeys } from '../../foundation/typography';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import { BADGE_TEXT, badgeRecipe } from './badgeRecipe';

export interface BadgeProps {
  children: ReactNode;
  size?: 'large' | 'medium' | 'small' | 'xsmall';
  color?: FgColorName | SdsColor;
  backgroundColor?: BgColorName | SdsColor;
  fontWeight?: FontWeightKeys;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
}

const useBadgeRecipe = createRecipe(badgeRecipe);

function resolveColor<Group extends SemanticColors['fg'] | SemanticColors['bg']>(
  group: Group,
  value: keyof Group | SdsColor,
): string {
  return Object.prototype.hasOwnProperty.call(group, value) ? (group as Readonly<Record<string, string>>)[value as string] : (value as string);
}

export const badgeVariantMap = useBadgeRecipe.variantMap;

export default function Badge({
  children,
  size = 'small',
  color,
  backgroundColor,
  fontWeight,
  numberOfLines,
  style,
}: BadgeProps) {
  const styles = useBadgeRecipe({ size });
  const semantic = useSemanticColors();
  const text = BADGE_TEXT[size];

  return (
    <View
      style={[
        styles.root,
        backgroundColor !== undefined && { backgroundColor: resolveColor(semantic.bg, backgroundColor) },
        style,
      ]}
    >
      <Txt
        typography={text.typography}
        fontWeight={fontWeight ?? text.fontWeight}
        style={[txtSlot(styles.label), color !== undefined && { color: resolveColor(semantic.fg, color) }]}
        numberOfLines={numberOfLines}
      >
        {children}
      </Txt>
    </View>
  );
}

export { Badge };
