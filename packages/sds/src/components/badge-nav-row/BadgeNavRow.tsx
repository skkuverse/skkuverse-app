import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, useSemanticColors } from '../../core/theme';
import { RowPressable } from '../pressable/RowPressable';
import { Tossface } from '../tossface';
import { Txt } from '../txt';

export interface BadgeNavRowProps {
  badge: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  tossface?: boolean;
}

export function BadgeNavRow({
  badge,
  title,
  subtitle,
  right,
  onPress,
  showChevron = true,
  disabled = false,
  tossface = false,
}: BadgeNavRowProps) {
  const styles = useStyles();
  const color = useSemanticColors();

  return (
    <View style={disabled ? styles.disabled : undefined}>
      <View style={styles.row}>
      <RowPressable
        onPress={onPress}
        disabled={disabled}
        style={styles.leftZone}
        contentStyle={styles.leftContent}
      >
        <View style={styles.badge}>
          {tossface ? (
            <Tossface size={22} style={styles.badgeEmoji}>{badge}</Tossface>
          ) : (
            <Txt typography="t7" fontWeight="bold" color="neutralSubtle">
              {badge}
            </Txt>
          )}
        </View>
        <View style={styles.texts}>
          <Txt typography="t7" fontWeight="regular">
            {title}
          </Txt>
          {subtitle != null && (
            <Txt typography="t3" fontWeight="regular" color="neutralSubtle">
              {subtitle}
            </Txt>
          )}
        </View>
      </RowPressable>

      {/* WHY: this zone claims the responder, so a tap on the caller's Switch never reaches the row's onPress. */}
      {right != null && (
        <View
          style={styles.switchZone}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          {right}
        </View>
      )}

      {showChevron && (
        <RowPressable
          onPress={onPress}
          disabled={disabled}
          hitSlop={8}
          contentStyle={styles.chevronContent}
        >
          <CaretRightIcon size={18} color={color.fg.placeholder} />
        </RowPressable>
      )}
      </View>
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
      </View>
    </View>
  );
}

const BADGE_SIZE = 40;

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
  },
  // WHY: SEED's disabled opacity fades the whole row, since `right` is the caller's node and no role reaches it.
  disabled: {
    opacity: 0.5,
  },
  leftZone: {
    flex: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SdsSpacing.x5,
    paddingVertical: SdsSpacing.x4,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: color.bg.neutralWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    // eslint-disable-next-line sds/no-type-size-literal -- the emoji's line box inside its badge; an emoji is not on the type scale
    lineHeight: 28,
  },
  texts: {
    flex: 1,
    marginLeft: SdsSpacing.x4,
    gap: SdsSpacing.x0_5,
  },
  switchZone: {
    paddingHorizontal: SdsSpacing.x1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronContent: {
    paddingLeft: SdsSpacing.x2,
    paddingRight: SdsSpacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerContainer: {
    paddingLeft: SdsSpacing.x5 + BADGE_SIZE + SdsSpacing.x4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.stroke.neutralSubtle,
  },
}));
