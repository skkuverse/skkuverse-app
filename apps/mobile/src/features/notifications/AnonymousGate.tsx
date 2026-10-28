import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ResultSection, createThemedStyles } from '@skkuverse/sds';
import { useT } from '@skkuverse/shared';

export function AnonymousGate() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={styles.container}>
      <ResultSection
        title={t('notifications.loginRequired')}
        primaryActionProps={{ children: t('notifications.loginCta'), onPress: () => router.replace('/login'), tone: 'brand' }}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
}));
