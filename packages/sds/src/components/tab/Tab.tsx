import React, {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { createRecipe } from '../../core/createRecipe';
import { useControlled } from '../../utils';
import { springConfig } from '../../foundation/easings';
import { Pressable, type PressableStyle } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import { TAB_LABEL_TEXT, tabRecipe } from './tabRecipe';

const useTabRecipe = createRecipe(tabRecipe);

export const tabVariantMap = useTabRecipe.variantMap;

interface TabContextValue {
  value: string;
  onChange: (value: string) => void;
  fluid: boolean;
  size: 'large' | 'small';
  registerLayout: (value: string, x: number, width: number) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export interface TabItemProps {
  value: string;
  children: ReactNode;
  accessibilityLabel?: string;
  redBean?: boolean;
  disabled?: boolean;
  style?: StyleProp<PressableStyle>;
  onPress?: (event: GestureResponderEvent) => void;
}

function TabItem({
  value,
  children,
  accessibilityLabel,
  redBean = false,
  disabled = false,
  style,
  onPress,
}: TabItemProps) {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('Tab.Item must be used within <Tab>');

  const isActive = ctx.value === value;
  const styles = useTabRecipe({ fluid: ctx.fluid, selected: isActive, disabled: disabled && !isActive });

  const handlePress = useCallback((event: GestureResponderEvent) => {
    onPress?.(event);
    ctx.onChange(value);
  }, [onPress, ctx, value]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      ctx.registerLayout(value, x, width);
    },
    [ctx, value],
  );

  return (
    <Pressable
      feedback="scale"
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isActive, disabled }}
      onPress={handlePress}
      onLayout={handleLayout}
      style={[pressableSlot(styles.item), style]}
    >
      <View style={styles.itemInner}>
        <Txt
          typography={TAB_LABEL_TEXT[ctx.size].typography}
          fontWeight={TAB_LABEL_TEXT[isActive ? 'selected' : 'rest'].fontWeight}
          style={txtSlot(styles.label)}
        >
          {children}
        </Txt>
        {redBean && <View style={styles.redBean} />}
      </View>
    </Pressable>
  );
}

export interface TabProps {
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  fluid?: boolean;
  size?: 'large' | 'small';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function TabRoot({
  value: controlledValue,
  onChange: controlledOnChange,
  defaultValue,
  fluid = false,
  size = 'large',
  children,
  style,
}: TabProps) {
  const styles = useTabRecipe();

  let derivedDefault = defaultValue ?? '';
  if (!derivedDefault) {
    Children.forEach(children, (child) => {
      if (!derivedDefault && React.isValidElement<{ value?: string }>(child) && child.props.value) {
        derivedDefault = child.props.value;
      }
    });
  }

  const [value, setValue] = useControlled({
    controlledValue,
    defaultValue: derivedDefault,
  });

  const handleChange = useCallback(
    (next: string) => {
      controlledOnChange?.(next);
      setValue(next);
    },
    [controlledOnChange, setValue],
  );

  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const [ready, setReady] = useState(false);

  const registerLayout = useCallback(
    (itemValue: string, x: number, width: number) => {
      layoutsRef.current[itemValue] = { x, width };
      if (itemValue === value) {
        indicatorX.set(withSpring(x, springConfig('quick')));
        indicatorW.set(withSpring(width, springConfig('quick')));
        if (!ready) setReady(true);
      }
    },
    [value, indicatorX, indicatorW, ready],
  );

  useEffect(() => {
    const layout = layoutsRef.current[value];
    if (layout) {
      indicatorX.set(withSpring(layout.x, springConfig('quick')));
      indicatorW.set(withSpring(layout.width, springConfig('quick')));
    }
  }, [value, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const content = (
    <TabContext.Provider value={{ value, onChange: handleChange, fluid, size, registerLayout }}>
      <View style={[styles.bar, style]}>
        <View style={styles.row}>{children}</View>
        <View style={styles.line} />
        {ready && <Animated.View style={[styles.indicator, indicatorStyle]} />}
      </View>
    </TabContext.Provider>
  );

  if (fluid) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={scrollStyles.fluidScroll}>
        {content}
      </ScrollView>
    );
  }

  return content;
}

export const Tab = Object.assign(TabRoot, {
  Item: TabItem,
});

const scrollStyles = StyleSheet.create({
  fluidScroll: {
    flexGrow: 0,
  },
});
