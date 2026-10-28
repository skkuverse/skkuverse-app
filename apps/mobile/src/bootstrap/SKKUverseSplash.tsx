import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { createThemedStyles } from '@skkuverse/sds';

interface Props {
  isReady?: boolean;
  onDismiss?: () => void;
}

export function SKKUverseSplash({ isReady = false, onDismiss }: Props) {
  const s = useS();

  useEffect(() => {
    if (!isReady) return;
    onDismiss?.();
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps -- dismisses once when ready, whatever onDismiss the parent passes

  return (
    <View style={s.root}>
      <Image
        source={require('../../assets/images/splash-icon.png')}
        style={s.icon}
        resizeMode="contain"
      />
    </View>
  );
}

const useS = createThemedStyles(({ color }) => ({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.bg.layerDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 160,
    height: 160,
  },
}));
