import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SdsRadius, SdsShadows, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, useSemanticColors } from '../../core/theme';
import { Txt } from '../txt';
import { Pressable } from '../pressable';

export const GLASS_AVAILABLE = isLiquidGlassAvailable();

/** WHY: both halves are needed: `boxShadow` is the New Architecture path, the other props cover older renderers and Android elevation. */
export const glassFloatShadow = {
  boxShadow: SdsShadows.glassFloat.boxShadow,
  ...SdsShadows.glassFloat.legacy,
} as const;

export function GlassSurface({
  style,
  children,
  interactive = false,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  interactive?: boolean;
}) {
  const styles = useStyles();
  if (GLASS_AVAILABLE) {
    return (
      <GlassView style={style} glassEffectStyle="regular" isInteractive={interactive}>
        {children}
      </GlassView>
    );
  }
  return <View style={[style, styles.fallback]}>{children}</View>;
}

/**
 * QUIRK(expo-glass-effect): a GlassView whose content resizes stays drawn at its first size or not at all, so the glass is a layer behind the content.
 * The shadow sits on an outer view so the rounded clip does not swallow it.
 */
export function GlassCard({
  style,
  contentStyle,
  radius = SdsRadius.r6,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
  children: ReactNode;
}) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    <View style={[style, !GLASS_AVAILABLE && [glassFloatShadow, { borderRadius: radius }]]}>
      <View style={[styles.cardClip, { borderRadius: radius }, !GLASS_AVAILABLE && styles.cardSolid]}>
        {GLASS_AVAILABLE && (
          <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" tintColor={color.bg.glassTint} />
        )}
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

export function GlassIconButton({
  icon,
  onPress,
  label,
  disabled = false,
  size = 40,
}: {
  icon: ReactNode;
  onPress?: () => void;
  label: string;
  disabled?: boolean;
  size?: number;
}) {
  const styles = useStyles();
  return (
    <GlassSurface
      interactive
      style={[styles.iconBtn, { width: size, height: size }]}
    >
      <Pressable
        bg={GLASS_AVAILABLE ? undefined : 'layerDefault'}
        feedback={GLASS_AVAILABLE ? 'none' : 'color'}
        onPress={onPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.fill, disabled && styles.disabled]}
      >
        {icon}
      </Pressable>
    </GlassSurface>
  );
}

export const GLASS_BUTTON_GROUP_SIZE = 44;

/** WHY: 9pt padding either side of t4's 21pt line; `Txt` ignores Dynamic Type, so the height is fixed and callers lay out from it. */
export const GLASS_CHIP_HEIGHT = 39;

export interface GlassButtonGroupItem {
  key: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}

/** WHY: the shadow is on the outer view and the rounded clip on the inner one, so the clip does not swallow the shadow. */
export function GlassButtonGroup({
  items,
  glass = true,
}: {
  items: readonly GlassButtonGroupItem[];
  /** WHY: false under Reduce Transparency, which ADR 0023 §2 draws as the white pill; the caller reads the setting and passes it. */
  glass?: boolean;
}) {
  const styles = useStyles();
  const onGlass = GLASS_AVAILABLE && glass;
  const buttons = items.map((item) => (
    <Pressable
      key={item.key}
      bg={onGlass ? undefined : 'layerDefault'}
      feedback={onGlass ? 'none' : 'color'}
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={styles.groupButton}
    >
      {item.icon}
    </Pressable>
  ));
  return (
    <View style={[styles.group, onGlass ? glassFloatShadow : styles.groupSolid]}>
      {onGlass ? (
        <GlassView style={styles.groupClip} glassEffectStyle="regular" isInteractive>
          {buttons}
        </GlassView>
      ) : (
        <View style={styles.groupClip}>{buttons}</View>
      )}
    </View>
  );
}

/** WHY: a selected chip bypasses the glass: a brand fill behind translucent glass reads as a muddy tint rather than a pressed state. */
export function GlassChip({
  icon,
  trailing,
  label,
  onPress,
  accent = false,
  selected = false,
  disabled = false,
}: {
  icon?: ReactNode;
  trailing?: ReactNode;
  label: string;
  onPress?: () => void;
  accent?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const body = (
    <Pressable
      bg={selected ? 'brandSolid' : GLASS_AVAILABLE ? undefined : 'layerDefault'}
      feedback={selected || !GLASS_AVAILABLE ? 'color' : 'none'}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={[styles.chipInner, disabled && styles.disabled]}
    >
      {icon ? <View style={styles.chipIcon}>{icon}</View> : null}
      <Txt
        typography="t4"
        fontWeight="semibold"
        color={selected ? 'onBrandSolid' : accent ? 'brand' : 'neutral'}
        numberOfLines={1}
        style={styles.chipLabel}
      >
        {label}
      </Txt>
      {trailing ? <View style={styles.chipTrailing}>{trailing}</View> : null}
    </Pressable>
  );

  if (selected) {
    return <View style={[styles.chip, styles.chipSelected]}>{body}</View>;
  }
  return (
    <GlassSurface interactive style={styles.chip}>
      {body}
    </GlassSurface>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  fallback: {
    backgroundColor: color.bg.layerDefault,
    ...SdsShadows.level2.legacy,
  },
  cardClip: { overflow: 'hidden', flexShrink: 1 },
  cardSolid: { backgroundColor: color.bg.layerDefault },
  fill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // WHY: SEED's disabled opacity fades the whole button, since the icon is the caller's node.
  disabled: {
    opacity: 0.5,
  },
  iconBtn: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
  },
  group: {
    height: GLASS_BUTTON_GROUP_SIZE,
    borderRadius: SdsRadius.full,
  },
  groupSolid: {
    backgroundColor: color.bg.layerDefault,
    ...SdsShadows.level2.legacy,
  },
  groupClip: {
    flexDirection: 'row',
    height: GLASS_BUTTON_GROUP_SIZE,
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
  groupButton: {
    width: GLASS_BUTTON_GROUP_SIZE,
    height: GLASS_BUTTON_GROUP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: color.bg.brandSolid,
    ...glassFloatShadow,
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
    paddingHorizontal: SdsSpacing.x3_5,
    // eslint-disable-next-line sds/no-spacing-literal -- the floating glass chip's height, GLASS_CHIP_HEIGHT (9 + t4's 21 + 9); the iOS 26 glass pill is drawn to its own metrics
    paddingVertical: 9,
  },
  chipIcon: {
    marginLeft: -SdsSpacing.x0_5,
  },
  chipTrailing: {
    marginLeft: -SdsSpacing.x0_5,
    marginRight: -SdsSpacing.x0_5,
  },
  chipLabel: {
    flexShrink: 1,
  },
}));
