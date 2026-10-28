import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { InfoIcon } from 'phosphor-react-native';
import { HsscMapScreen } from '@/features/hssc/HsscMapScreen';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { useSemanticColors, createThemedStyles } from '@skkuverse/sds';

export default function HSSCMapRoute() {
  const styles = useStyles();
  const color = useSemanticColors();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIconButton
              onPress={() => router.push('/map/hssc-credit' as never)}
            >
              <InfoIcon size={22} color={color.fg.neutral} />
            </HeaderIconButton>
          ),
        }}
      />
      <HsscMapScreen />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
}));
