import { Platform, View } from 'react-native';
import { useRouter, type NativeStackNavigationOptions } from 'expo-router';
import { BellIcon, ArchiveIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { logNoticesContentSelect } from '@/platform/analytics';

// QUIRK(rnscreens): an opaque bar, not transparent with blur: the root is a FlatList that native-stack does
// not always auto-inset, so a transparent bar hid the tab strip beneath it.
export function useNoticesHeaderOptions(): NativeStackNavigationOptions {
  const color = useSemanticColors();
  const router = useRouter();
  const { t } = useT();
  return {
    title: '',
    ...(Platform.OS === 'ios'
      ? {
          unstable_headerRightItems: () => [
            {
              type: 'button' as const,
              label: t('notices.accessory.bookmark'),
              icon: {
                type: 'image' as const,
                source: require('../../../assets/header-icons/archive.png'),
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: t('notices.accessory.bookmark'),
              onPress: () => {
                logNoticesContentSelect({ content_type: 'header_bookmark', item_id: 'saved' });
                router.push('/notices/saved' as never);
              },
            },
            {
              type: 'button' as const,
              label: t('settings.notifications'),
              icon: {
                type: 'image' as const,
                source: require('../../../assets/header-icons/bell.png'),
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: t('settings.notifications'),
              onPress: () => {
                logNoticesContentSelect({ content_type: 'header_bell', item_id: 'notifications' });
                router.push('/notifications/notices' as never);
              },
            },
          ],
        }
      : {
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: SdsSpacing.x2 }}>
              <HeaderIconButton
                onPress={() => {
                  logNoticesContentSelect({ content_type: 'header_bookmark', item_id: 'saved' });
                  router.push('/notices/saved' as never);
                }}
                accessibilityLabel={t('notices.accessory.bookmark')}
              >
                <ArchiveIcon
                  size={22}
                  color={color.fg.neutralMuted}
                />
              </HeaderIconButton>
              <HeaderIconButton
                onPress={() => {
                  logNoticesContentSelect({ content_type: 'header_bell', item_id: 'notifications' });
                  router.push('/notifications/notices' as never);
                }}
                accessibilityLabel={t('settings.notifications')}
              >
                <BellIcon size={22} color={color.fg.neutralMuted} />
              </HeaderIconButton>
            </View>
          ),
        }),
  };
}
