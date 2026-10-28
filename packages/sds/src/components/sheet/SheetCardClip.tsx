/**
 * QUIRK(gorhom-bottom-sheet): nothing clips content to the card; a detached body is `overflow: 'visible'` and a travelling one is as tall as the top detent.
 * QUIRK(ios): UIKit clips a uniformly rounded box with a continuous corner but mixed radii with a circular mask, so each box
 * owns one edge's corners and reaches `SHEET_CLIP_REACH` past the content; no box takes an opacity, which would blank the glass.
 */

import { useCallback, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import { SHEET_CLIP_REACH, sheetContentClip, type SheetCardKind } from './chrome';
import { useSheetMotion } from './useSheetMotion';

interface SheetCardClipProps {
  kind: SheetCardKind;
  lastIndex: number;
  pageAtTop: boolean;
  floatBottomGap: number;
  children: ReactNode;
}

export function SheetCardClip({ kind, lastIndex, pageAtTop, floatBottomGap, children }: SheetCardClipProps) {
  const { animatedLayoutState } = useBottomSheetInternal();
  // WHY: gorhom's own values, the ones the background reads, so the clip and the card see the same frame.
  const { animatedIndex, animatedPosition } = useSheetMotion();
  // WHY: measured from the content box's own layout, since a keyboard or a `fit` sheet changes it; a layout pass, not a drag frame, writes it.
  const contentHeight = useSharedValue(0);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => contentHeight.set(event.nativeEvent.layout.height),
    [contentHeight],
  );

  const clip = useDerivedValue(() => {
    const { containerHeight, handleHeight } = animatedLayoutState.get();
    return sheetContentClip(kind, animatedIndex.get(), lastIndex, pageAtTop, floatBottomGap, {
      containerHeight,
      bodyTop: animatedPosition.get(),
      handleHeight,
      contentHeight: contentHeight.get(),
    });
  }, [kind, lastIndex, pageAtTop, floatBottomGap]);

  const topClip = useAnimatedStyle(() => ({ borderRadius: clip.get().top }));
  const bottomClip = useAnimatedStyle(() => {
    const { bottom, overhang } = clip.get();
    return { borderRadius: bottom, transform: [{ translateY: -overhang }] };
  });
  const content = useAnimatedStyle(() => ({ transform: [{ translateY: clip.get().overhang }] }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.topClip, topClip]}>
      <Animated.View pointerEvents="box-none" style={[styles.bottomClip, bottomClip]}>
        <Animated.View pointerEvents="box-none" onLayout={onLayout} style={[styles.content, content]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** WHY: each box grows and shrinks to its parent as gorhom's content box would have laid out the content, so a `fit` sheet keeps its content's height. */
const styles = StyleSheet.create({
  topClip: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: 'hidden',
    borderCurve: 'continuous',
    marginBottom: -SHEET_CLIP_REACH,
    paddingBottom: SHEET_CLIP_REACH,
  },
  bottomClip: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: 'hidden',
    borderCurve: 'continuous',
    marginTop: -SHEET_CLIP_REACH,
    paddingTop: SHEET_CLIP_REACH,
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
