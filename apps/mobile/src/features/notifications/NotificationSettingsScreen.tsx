import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { AnonymousGate } from './AnonymousGate';
import { EnableNotificationsSheet } from './EnableNotificationsSheet';
import { HintBanner } from './HintBanner';
import { useNotificationSettings } from './useNotificationSettings';

export default function NotificationSettingsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useT();
  const { appLanguage, authReady, enableSheetRef } = useNotificationSettings();

  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {appLanguage === 'zh' && (
          <HintBanner message={t('notifications.zhHint')} />
        )}

        <View style={styles.categories}>
          <BadgeNavRow
            badge="📢"
            tossface
            title={t('notifications.notices')}
            subtitle={t('notifications.noticesSubtitle')}
            onPress={() => router.push('/notifications/notices')}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <EnableNotificationsSheet ref={enableSheetRef} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    paddingBottom: SdsSpacing.x8,
  },
  categories: {
    marginTop: 0,
  },
  bottomSpacer: {
    height: 80,
  },
}));
