import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createThemedStyles } from '@skkuverse/sds';

interface SectionCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionCard({ children, style }: SectionCardProps) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    backgroundColor: color.bg.layerDefault,
  },
}));
