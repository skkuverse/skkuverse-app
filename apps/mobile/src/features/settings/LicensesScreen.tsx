import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { BadgeNavRow, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';

export function LicensesScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BadgeNavRow
          badge="📄"
          tossface
          title={t('settings.tos')}
          onPress={() => router.push('/settings/licenses/tos' as never)}
        />
        <BadgeNavRow
          badge="🔗"
          tossface
          title={t('settings.attributions')}
          onPress={() => router.push('/settings/licenses/attributions' as never)}
        />
        <BadgeNavRow
          badge="📦"
          tossface
          title={t('settings.licensesOss')}
          onPress={() => router.push('/settings/licenses/oss' as never)}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: SdsSpacing.x8,
  },
}));
