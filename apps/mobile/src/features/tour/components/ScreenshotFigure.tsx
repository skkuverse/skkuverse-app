import { useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { SdsRadius } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';

interface Props {
  source: ImageSourcePropType;
  /** WHY: the image's own width / height, so the frame hugs it and `cover` never crops. */
  aspect: number;
}

// WHY: sized from the measured gap, not `aspectRatio` or `contain`: a full screen is limited by the
// gap's height, a cropped list by its width, and the rounded border must hug the image in both.
export function ScreenshotFigure({ source, aspect }: Props) {
  const styles = useStyles();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  const size =
    box && box.width / box.height > aspect
      ? { width: box.height * aspect, height: box.height }
      : box && { width: box.width, height: box.width / aspect };

  return (
    <View style={styles.gap} onLayout={handleLayout}>
      {size && <Image source={source} style={[styles.shot, size]} contentFit="cover" />}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  gap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shot: {
    borderRadius: SdsRadius.r5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke.neutralMuted,
  },
}));
