import { Platform, View } from 'react-native';
import { useRouter, type NativeStackNavigationOptions } from 'expo-router';
import { DotsThreeIcon, UserCircleIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { logHomeContentSelect } from '@/platform/analytics';

export function useHomeHeaderOptions(): NativeStackNavigationOptions {
  const color = useSemanticColors();
  const router = useRouter();
  const { t } = useT();
  return {
    title: '',
    ...(Platform.OS === 'ios'
      ? {
          // QUIRK(ios): the bar is transparent at scroll-top and iOS fades in the blur as content scrolls under it; this needs the inherited opaque headerStyle background overridden.
          headerBlurEffect: 'systemChromeMaterial',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          unstable_headerRightItems: () => [
            {
              type: 'button' as const,
              label: t('settings.account'),
              icon: {
                type: 'image' as const,
                source: require('../../../assets/header-icons/user-circle.png'),
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: t('settings.account'),
              onPress: () => {
                logHomeContentSelect({ content_type: 'profile', item_id: 'account' });
                router.push('/settings/account' as never);
              },
            },
            {
              type: 'button' as const,
              label: t('settings.title'),
              icon: {
                type: 'image' as const,
                source: require('../../../assets/header-icons/dots-three.png'),
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: t('settings.title'),
              onPress: () => {
                logHomeContentSelect({ content_type: 'settings', item_id: 'root' });
                router.push('/settings' as never);
              },
            },
          ],
        }
      : {
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: SdsSpacing.x2 }}>
              <HeaderIconButton
                onPress={() => {
                  logHomeContentSelect({ content_type: 'profile', item_id: 'account' });
                  router.push('/settings/account' as never);
                }}
                accessibilityLabel={t('settings.account')}
              >
                <UserCircleIcon
                  size={22}
                  color={color.fg.neutralMuted}
                />
              </HeaderIconButton>
              <HeaderIconButton
                onPress={() => {
                  logHomeContentSelect({ content_type: 'settings', item_id: 'root' });
                  router.push('/settings' as never);
                }}
                accessibilityLabel={t('settings.title')}
              >
                <DotsThreeIcon
                  size={24}
                  color={color.fg.neutralMuted}
                  weight="bold"
                />
              </HeaderIconButton>
            </View>
          ),
        }),
  };
}
