import React, {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SdsRadius, SdsShadows, SdsSpacing } from '@skkuverse/shared';
import { createRecipe } from '../../core/createRecipe';
import { springConfig } from '../../foundation/easings';
import { Pressable, type PressableStyle } from '../pressable';
import { pressableSlot } from '../pressable/pressableSlot';
import { Txt } from '../txt';
import { txtSlot } from '../txt/txtSlot';
import {
  SEGMENTED_LABEL_WEIGHT,
  segmentedControlRecipe,
  segmentedTrackInset,
} from './segmentedControlRecipe';

const useSegmentedControlRecipe = createRecipe(segmentedControlRecipe);

export const segmentedControlVariantMap = useSegmentedControlRecipe.variantMap;

const TRACK_INSET = segmentedTrackInset({ spacing: SdsSpacing });

interface SegmentedContextValue {
  value: string;
  onValueChange: (value: string) => void;
  registerItem: (value: string, index: number) => void;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

export interface SegmentedControlItemProps {
  value: string;
  children: ReactNode;
  typography?: import('../../foundation/typography').TypographyKeys;
  style?: StyleProp<PressableStyle>;
}

function SegmentedControlItem({ value, children, typography = 't5', style }: SegmentedControlItemProps) {
  const ctx = useContext(SegmentedContext);
  if (!ctx) throw new Error('SegmentedControl.Item must be used within <SegmentedControl>');

  const isActive = ctx.value === value;
  const styles = useSegmentedControlRecipe({ selected: isActive });

  const handlePress = useCallback(() => {
    ctx.onValueChange(value);
  }, [ctx, value]);

  return (
    <Pressable feedback="scale" onPress={handlePress} style={[pressableSlot(styles.item), style]}>
      <Txt
        typography={typography}
        fontWeight={SEGMENTED_LABEL_WEIGHT[isActive ? 'selected' : 'rest']}
        style={txtSlot(styles.label)}
      >
        {children}
      </Txt>
    </Pressable>
  );
}

export interface SegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function SegmentedControlRoot({
  value,
  onValueChange,
  children,
  style,
}: SegmentedControlProps) {
  const styles = useSegmentedControlRecipe();
  const itemCount = Children.count(children);
  const [containerWidth, setContainerWidth] = useState(0);

  const values: string[] = [];
  Children.forEach(children, (child) => {
    if (React.isValidElement<{ value?: string }>(child) && child.props.value) {
      values.push(child.props.value);
    }
  });

  const activeIndex = values.indexOf(value);
  const padding = TRACK_INSET;
  const itemWidth = itemCount > 0 ? (containerWidth - padding * 2) / itemCount : 0;

  const translateX = useSharedValue(activeIndex * itemWidth);

  useEffect(() => {
    if (itemWidth > 0) {
      translateX.set(withSpring(activeIndex * itemWidth, springConfig('quick')));
    }
  }, [activeIndex, itemWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: itemWidth,
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // WHY: the indicator takes the track's radius inset by its padding, so a capsule track gets a capsule indicator rather than a rounded rectangle.
  const trackRadius = StyleSheet.flatten(style)?.borderRadius;
  const indicatorRadius =
    typeof trackRadius === 'number' ? Math.max(0, trackRadius - padding) : SdsRadius.r2;

  const registerItem = useCallback((_value: string, _index: number) => {}, []);

  return (
    <SegmentedContext.Provider value={{ value, onValueChange, registerItem }}>
      <View
        style={[styles.track, style]}
        onLayout={handleLayout}
      >
        {itemWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              SdsShadows.segmentedIndicator.legacy,
              {
                // WHY: `bottom`, not `height: '100%'`, which resolves against the padding box and ran the indicator past the bottom edge.
                top: padding,
                bottom: padding,
                borderRadius: indicatorRadius,
              },
              indicatorStyle,
            ]}
          />
        )}
        {children}
      </View>
    </SegmentedContext.Provider>
  );
}

export const SegmentedControl = Object.assign(SegmentedControlRoot, {
  Item: SegmentedControlItem,
});
