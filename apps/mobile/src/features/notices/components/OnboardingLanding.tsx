import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Button, Txt, TextButton, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { NoticePreviewCard } from '@/components/previews/NoticePreviewCard';
import { logNoticesContentSelect } from '@/platform/analytics';
import { useOnboardingLanding } from './useOnboardingLanding';

// QUIRK(ios): iOS 26's floating Liquid Glass tab bar is not in safeAreaInsets, while the JSX tab bar
// elsewhere is, so only iOS 26 absorbs it.
const GLASS_AVAILABLE = isLiquidGlassAvailable();

interface Props {
  onStartPress: () => void;
  onExistingAccountPress: () => void;
  /** WHY: both CTAs disable while a sign-in is in flight, against a double tap. */
  loading?: boolean;
  signInError?: string | null;
}

// WHY: NoticePreviewCard is shared with the first-launch intro, so the two surfaces cannot drift.
export function OnboardingLanding({
  onStartPress,
  onExistingAccountPress,
  loading = false,
  signInError = null,
}: Props) {
  const styles = useStyles();
  const { t } = useT();
  const { isAnonymous } = useOnboardingLanding();
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <View>
          <Txt typography="t13" fontWeight="bold">
            성균관대 공지,
          </Txt>
          <Txt typography="t13" fontWeight="bold">
            찾지 말고 받아보세요
          </Txt>
          <Txt typography="t8" color="neutralSubtle" style={styles.subtitle}>
            AI가 중요한 내용만 알려드려요
          </Txt>
        </View>

        <View style={styles.cardWrapper}>
          <NoticePreviewCard />
        </View>

        <View>
          <Button
            tone="brand"
            size="large"
            display="block"
            onPress={() => {
              logNoticesContentSelect({ content_type: 'onboarding_landing_cta', item_id: 'start' });
              onStartPress();
            }}
            disabled={loading}
          >
            {t('onboarding.landingCta')}
          </Button>
          {isAnonymous ? (
            <TextButton
              typography="t5"
              color="placeholder"
              fontWeight="medium"
              onPress={() => {
                logNoticesContentSelect({ content_type: 'onboarding_landing_signin', item_id: 'existing' });
                onExistingAccountPress();
              }}
              disabled={loading}
              style={styles.existingAccountButton}
            >
              {t('onboarding.landingExistingAccountCta')}
            </TextButton>
          ) : null}
          {signInError ? (
            <Txt typography="t3" color="critical" style={styles.error}>
              {signInError}
            </Txt>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  inner: {
    flex: 1,
    paddingTop: SdsSpacing.x14,
    paddingHorizontal: SdsSpacing.x6,
    paddingBottom: GLASS_AVAILABLE ? 80 : 24,
  },
  subtitle: {
    marginTop: SdsSpacing.x4,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: SdsSpacing.x7,
  },
  existingAccountButton: {
    alignSelf: 'center',
    marginTop: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x2,
  },
  error: {
    textAlign: 'center',
    marginTop: SdsSpacing.x2,
  },
}));
