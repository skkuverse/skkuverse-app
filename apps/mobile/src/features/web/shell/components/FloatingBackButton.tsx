import type { ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CaretLeftIcon } from 'phosphor-react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { GlassIconButton, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { FLOATING_BTN } from './floating-button.constants';

export function FloatingBackButton({ pill }: { pill: ReactNode }) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    <View style={styles.floatingLeft}>
      <GlassIconButton
        icon={<CaretLeftIcon size={20} color={color.fg.neutral} weight="bold" />}
        label="뒤로"
        onPress={() => router.back()}
        size={FLOATING_BTN}
      />
      {pill}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  floatingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
}));
