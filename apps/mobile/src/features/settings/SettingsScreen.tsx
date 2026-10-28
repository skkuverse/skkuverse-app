import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeNavRow, createThemedStyles, Pressable, Txt } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { openAppFirst } from '@/features/web/web.service';
import { logSettingsContentSelect } from '@/platform/analytics';
import { isPrereleaseBuild } from '@/platform/ota';
import { OPENABLE_APP_SCHEMES } from '../../../config/external-apps';
import { openExternalUrl } from '@/platform/handoff';

// QUIRK(kakao): pf.kakao.com reaches the app by universal link (iOS) or `intent://`
// (Android), so it never goes through /webview; the path is what Kakao's iOS SDK builds.
const KAKAO_CHANNEL = {
  appUrl: 'kakaoplus://plusfriend/talk/chat/_cjxexdG',
  url: 'https://pf.kakao.com/_cjxexdG/chat',
};

export function SettingsScreen() {
  const devStyles = useDevStyles();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useT();

  // WHY: developer tooling reads isPrereleaseBuild directly; __DEV__ is false in TestFlight.
  const showDevMenu = isPrereleaseBuild();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BadgeNavRow
          badge="👤"
          tossface
          title={t('settings.account')}
          subtitle={t('settings.accountSubtitle')}
          onPress={() => {
            logSettingsContentSelect({ content_type: 'row_account', item_id: 'account' });
            router.push('/settings/account' as never);
          }}
        />
        <BadgeNavRow
          badge="🔔"
          tossface
          title={t('settings.notifications')}
          subtitle={t('settings.notificationsSubtitle')}
          onPress={() => {
            logSettingsContentSelect({ content_type: 'row_notifications', item_id: 'settings' });
            router.push('/notifications/settings' as never);
          }}
        />
        <BadgeNavRow
          badge="💬"
          tossface
          title={t('settings.contact.title')}
          subtitle={t('settings.contact.subtitle')}
          onPress={() => {
            logSettingsContentSelect({ content_type: 'row_kakao', item_id: 'channel' });
            void openAppFirst(KAKAO_CHANNEL, openExternalUrl, OPENABLE_APP_SCHEMES);
          }}
        />
        {/* WHY: RELEASE-GATE(debug-menu); remove the debug log row before an App Store release. */}
        {showDevMenu && (
          <>
            {/* WHY: no role holds the dev buttons' dark fill, so the press only shrinks them. */}
            <Pressable
              style={devStyles.devButton}
              onPress={() => router.push('/settings/debug-logs' as never)}
            >
              <View style={[devStyles.devSurface, devStyles.devSurfaceLogs]}>
                <Txt typography="t4" fontWeight="semibold" style={devStyles.devButtonText}>🪵 디버그 로그 (dev only)</Txt>
              </View>
            </Pressable>
            <Pressable
              style={devStyles.devButton}
              onPress={() => router.push('/sds-states' as never)}
            >
              <View style={[devStyles.devSurface, devStyles.devSurfaceBrowser]}>
                <Txt typography="t4" fontWeight="semibold" style={devStyles.devButtonText}>🎨 SDS 상태 카탈로그 (dev only)</Txt>
              </View>
            </Pressable>
            {/* WHY: the switch arms nothing on a beta build, so the row would mislead there. */}
            {__DEV__ && (
              <BadgeNavRow
                badge="🧪"
                tossface
                title="Auth faults (dev only)"
                subtitle="Make a sign-in or the App Check probe fail with a recorded shape"
                onPress={() => router.push('/auth-faults' as never)}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useDevStyles = createThemedStyles(({ color }) => ({
  devButton: {
    marginTop: SdsSpacing.x3,
    marginHorizontal: SdsSpacing.x4,
  },
  devSurface: {
    borderRadius: SdsRadius.r2_5,
    paddingVertical: SdsSpacing.x3,
    alignItems: 'center',
  },
  devSurfaceBrowser: {
    backgroundColor: color.bg.neutralSolid,
  },
  devSurfaceLogs: {
    backgroundColor: color.bg.neutralSolid,
  },
  devButtonText: { color: color.fg.onNeutralSolid },
}));

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SdsSpacing.x8,
  },
}));
