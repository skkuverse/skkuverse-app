/** WHY: it renders siblings (the CTA, then `below`), so place it directly in the full-screen column it sits at the bottom of. */
import React, { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '../../core/theme';

export interface FixedBottomCTAContext {
  keyboardVisible: boolean;
}

export interface FixedBottomCTAProps {
  children: ReactNode | ((ctx: FixedBottomCTAContext) => ReactNode);
  /** WHY: never lifted above the keyboard, so it holds nothing a typing user needs: iOS leaves it for the keyboard to cover, Android hides it. */
  below?: ReactNode;
  enableKeyboardAvoiding?: boolean;
  flushOnKeyboard?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PADDING_HORIZONTAL = SdsSpacing.x5;
const PADDING_TOP = SdsSpacing.x3;
const MIN_PADDING_BOTTOM = SdsSpacing.x4;

function useKeyboardVisible(): boolean {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardVisible;
}

// QUIRK(react-native): Fabric runs KeyboardAvoidingView's LayoutAnimation linearly, so the keyboard overtook the CTA; keyboard-controller's own view got no close frames on the iOS 26.5 simulator either.
// The padding follows the provider's `height`, set once per move, so it rides the keyboard's curve both ways. `below` sits outside the avoiding view,
// which pads by its own bottom's overlap with the keyboard, so the CTA and `below` return as siblings and nothing mounts mid-animation.
function FixedBottomCTAIOS({
  children,
  below,
  enableKeyboardAvoiding = true,
  flushOnKeyboard = false,
  style,
}: FixedBottomCTAProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisible();
  // QUIRK(react-native-keyboard-controller): `height` is 0 when closed and minus the keyboard's height when open.
  const { height, progress } = useReanimatedKeyboardAnimation();
  // WHY: padding grows the view upward, so its bottom edge stays put while the keyboard moves.
  const bottom = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { y, height: viewHeight } = e.nativeEvent.layout;
    bottom.value = y + viewHeight;
  };

  const avoidStyle = useAnimatedStyle(() => {
    const keyboardTop = windowHeight + height.value;
    return { paddingBottom: Math.max(0, bottom.value - keyboardTop) };
  });

  const flushStyle = useAnimatedStyle(() => {
    const visible = flushOnKeyboard ? progress.value : 0;
    return {
      paddingHorizontal: interpolate(visible, [0, 1], [PADDING_HORIZONTAL, 0]),
      paddingTop: interpolate(visible, [0, 1], [PADDING_TOP, 0]),
    };
  });

  const renderedChildren =
    typeof children === 'function' ? children({ keyboardVisible }) : children;

  const content = (
    <Animated.View style={[styles.container, flushStyle, style]}>
      {renderedChildren}
    </Animated.View>
  );

  return (
    <>
      {enableKeyboardAvoiding ? (
        <Animated.View onLayout={onLayout} style={avoidStyle}>
          {content}
        </Animated.View>
      ) : (
        content
      )}
      <View
        accessibilityElementsHidden={keyboardVisible}
        style={[
          styles.container,
          styles.below,
          { paddingBottom: Math.max(insets.bottom, MIN_PADDING_BOTTOM) },
        ]}
      >
        {below}
      </View>
    </>
  );
}

function FixedBottomCTADefault({
  children,
  below,
  enableKeyboardAvoiding = true,
  flushOnKeyboard = false,
  style,
}: FixedBottomCTAProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  const flush = flushOnKeyboard && keyboardVisible;
  const paddingBottom = keyboardVisible ? 0 : Math.max(insets.bottom, MIN_PADDING_BOTTOM);
  const paddingHorizontal = flush ? 0 : PADDING_HORIZONTAL;
  const paddingTop = flush ? 0 : PADDING_TOP;

  const renderedChildren =
    typeof children === 'function' ? children({ keyboardVisible }) : children;

  const content = (
    <View
      style={[
        styles.container,
        { paddingBottom, paddingHorizontal, paddingTop },
        style,
      ]}
    >
      {renderedChildren}
      {!keyboardVisible && below}
    </View>
  );

  if (!enableKeyboardAvoiding) return content;

  // QUIRK(android): edge to edge, the window is not resized for the keyboard, so without 'padding' the keyboard covers the CTA.
  // Enabled only while the keyboard is up: the hide event reports the keyboard's top without the system bars,
  // so an always-on view keeps that gap as padding and the CTA stays raised.
  return (
    <KeyboardAvoidingView behavior="padding" enabled={keyboardVisible}>
      {content}
    </KeyboardAvoidingView>
  );
}

const FixedBottomCTA = Platform.OS === 'ios' ? FixedBottomCTAIOS : FixedBottomCTADefault;

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    backgroundColor: color.bg.layerDefault,
  },
  below: {
    paddingHorizontal: PADDING_HORIZONTAL,
  },
}));

export default FixedBottomCTA;
export { FixedBottomCTA };
