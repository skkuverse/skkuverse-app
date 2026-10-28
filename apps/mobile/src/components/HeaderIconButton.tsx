import type { ReactNode } from 'react';
import { PlatformColor, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, type PressableProps, glassFloatShadow, createThemedStyles } from '@skkuverse/sds';
import { SdsRadius } from '@skkuverse/shared';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

/**
 * QUIRK(react-native-screens): `headerRight` sits in a UIBarButtonItem customView that stretches an
 * unsized child, and iOS 26's 36pt capsule pulls any other size off-centre, so the plain button is a
 * fixed 36×36 (software-mansion/react-native-screens#2990); hitSlop 10 makes the tap area 56×56.
 */
interface Props extends Omit<PressableProps, 'children' | 'style' | 'bg' | 'feedback' | 'scaleScope' | 'contentStyle'> {
  children: ReactNode;
  // WHY: only outside a native Stack header; inside one the system bar already draws the capsule.
  glass?: boolean;
}

/** QUIRK(ios): a bar button's custom view dims while held and interactive glass answers the touch, so no `Pressable` feedback. */
export function HeaderIconButton({ children, glass = false, ...rest }: Props) {
  const styles = useStyles();
  if (glass && GLASS_AVAILABLE) {
    // WHY: `glassFloatShadow`, level 2 softened, since the full level is too strong against the
    // capsule's specular highlight.
    return (
      <View style={[styles.glassOuter, glassFloatShadow]}>
        <View style={styles.glassFillBase}>
          <GlassView style={styles.glassSurface} glassEffectStyle="regular" isInteractive>
            <Pressable feedback="none" hitSlop={10} {...rest} style={styles.glassPressable}>
              {children}
            </Pressable>
          </GlassView>
        </View>
      </View>
    );
  }
  return (
    <Pressable feedback="none" hitSlop={10} {...rest} style={styles.root}>
      {children}
    </Pressable>
  );
}

const useStyles = createThemedStyles(() => ({
  root: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // EVIDENCE: 44×44 is within 3pt of the native `unstable_headerRightItems` capsule (about 47pt,
  // measured), and puts the icon at 0.41 of it, inside the HIG's 0.40-0.45 rather than a cramped 0.50.
  glassOuter: {
    width: 44,
    height: 44,
    borderRadius: SdsRadius.full,
  },
  // QUIRK(ios): a native bar button's capsule refracts a blurred bar and gets a `secondarySystemFill`
  // tone; over a solid header the glass has nothing to refract, so this paints that fill under it.
  glassFillBase: {
    width: 44,
    height: 44,
    borderRadius: SdsRadius.full,
    overflow: 'hidden',
    // WHY: the system's own fill, so it follows the scheme as the native capsule's does.
    backgroundColor: PlatformColor('secondarySystemFill'),
  },
  glassSurface: {
    flex: 1,
  },
  glassPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
