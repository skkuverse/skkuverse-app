import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useT } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';

export default function TosRoute() {
  const styles = useStyles();
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.tos') }} />
      <View style={styles.container} />
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
}));
