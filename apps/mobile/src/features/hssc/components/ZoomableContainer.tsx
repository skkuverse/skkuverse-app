import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  clamp,
  runOnJS,
} from 'react-native-reanimated';
import { findElementAtPoint } from '../element-hit.rules';
import { Loader } from '@skkuverse/sds';

export interface ZoomableContainerRef {
  animateTo: (cx: number, cy: number, targetScale: number) => void;
  getFitScale: () => number;
}

interface ZoomableContainerProps {
  contentWidth: number;
  contentHeight: number;
  onElementTap: (elementId: string) => void;
  onBackgroundTap?: () => void;
  onReady?: () => void;
  children: ReactNode;
}

const MAX_SCALE = 3.0;
const TIMING_CONFIG = { duration: 400 };

export const ZoomableContainer = forwardRef<
  ZoomableContainerRef,
  ZoomableContainerProps
>(function ZoomableContainer(
  { contentWidth, contentHeight, onElementTap, onBackgroundTap, onReady, children },
  ref,
) {
  // WHY: the window size is the first estimate so nothing flashes blank before onLayout corrects it.
  const dims = useWindowDimensions();
  const [containerW, setContainerW] = useState(dims.width);
  const [containerH, setContainerH] = useState(dims.height * 0.85);
  const [measured, setMeasured] = useState(false);

  const onContainerLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      setContainerW(width);
      setContainerH(height);
      if (!measured) {
        setMeasured(true);
        const fitScale = height / contentHeight;
        scale.value = fitScale;
        savedScale.value = fitScale;
        onReady?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the shared values are stable, and onReady fires once with the first layout
    [measured, contentHeight],
  );

  const initialScale = containerH / contentHeight;
  const minScale = initialScale * 0.7;

  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(initialScale);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const cW = useSharedValue(containerW);
  const cH = useSharedValue(containerH);
  const minS = useSharedValue(minScale);
  // QUIRK(react-native-reanimated): writing shared values during render trips its strict-mode warning.
  useEffect(() => {
    cW.value = containerW;
    cH.value = containerH;
    minS.value = minScale;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the shared values are stable refs
  }, [containerW, containerH, minScale]);

  const clampTranslation = useCallback(
    (tx: number, ty: number, s: number) => {
      'worklet';
      const scaledW = contentWidth * s;
      const scaledH = contentHeight * s;
      const maxTx = Math.max(0, (scaledW - cW.value) / 2);
      const maxTy = Math.max(0, (scaledH - cH.value) / 2);
      return {
        x: clamp(tx, -maxTx, maxTx),
        y: clamp(ty, -maxTy, maxTy),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a worklet over shared values, which are stable refs
    [contentWidth, contentHeight],
  );

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      'worklet';
      savedScale.value = scale.value;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = clamp(savedScale.value * e.scale, minS.value, MAX_SCALE);
      const ds = newScale / savedScale.value;
      const newTx = savedTranslateX.value + (1 - ds) * (focalX.value - cW.value / 2);
      const newTy = savedTranslateY.value + (1 - ds) * (focalY.value - cH.value / 2);
      scale.value = newScale;
      const clamped = clampTranslation(newTx, newTy, newScale);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .minDistance(10)
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const newTx = savedTranslateX.value + e.translationX;
      const newTy = savedTranslateY.value + e.translationY;
      const clamped = clampTranslation(newTx, newTy, scale.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const handleTapHit = useCallback(
    (svgX: number, svgY: number) => {
      const elementId = findElementAtPoint(svgX, svgY);
      if (elementId) {
        onElementTap(elementId);
      } else {
        onBackgroundTap?.();
      }
    },
    [onElementTap, onBackgroundTap],
  );

  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(10)
    .onEnd((e) => {
      'worklet';
      const svgX =
        (e.x - cW.value / 2 - translateX.value) / scale.value +
        contentWidth / 2;
      const svgY =
        (e.y - cH.value / 2 - translateY.value) / scale.value +
        contentHeight / 2;
      runOnJS(handleTapHit)(svgX, svgY);
    });

  const pinchPan = Gesture.Simultaneous(pinchGesture, panGesture);
  const composed = Gesture.Exclusive(pinchPan, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useImperativeHandle(ref, () => ({
    getFitScale() {
      return containerH / contentHeight;
    },
    animateTo(cx: number, cy: number, targetScale: number) {
      const clampedScale = Math.min(Math.max(targetScale, minScale), MAX_SCALE);
      const newTx = -(cx - contentWidth / 2) * clampedScale;
      const newTy = -(cy - contentHeight / 2) * clampedScale;
      const clamped = clampTranslation(newTx, newTy, clampedScale);

      scale.value = withTiming(clampedScale, TIMING_CONFIG);
      translateX.value = withTiming(clamped.x, TIMING_CONFIG);
      translateY.value = withTiming(clamped.y, TIMING_CONFIG);
      savedScale.value = clampedScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    },
  }));

  return (
    <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onContainerLayout}>
      {!measured ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loader size="medium" tone="neutral" delay={700} />
        </View>
      ) : (
        <GestureDetector gesture={composed}>
          {/* WHY: the outer view keeps the container size, which is the reference for tap coordinates. */}
          <Animated.View style={{ flex: 1 }}>
            <Animated.View
              style={[
                {
                  width: contentWidth,
                  height: contentHeight,
                  position: 'absolute',
                  left: (containerW - contentWidth) / 2,
                  top: (containerH - contentHeight) / 2,
                },
                animatedStyle,
              ]}
            >
              {children}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
});
