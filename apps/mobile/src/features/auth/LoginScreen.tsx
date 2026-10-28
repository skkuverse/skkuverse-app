import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Txt, createThemedStyles } from '@skkuverse/sds';
import { SdsSpacing, useT, SdsRadius } from '@skkuverse/shared';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useLogin } from './useLogin';

export function LoginScreen() {
  const styles = useStyles();
  const { t } = useT();
  const { loading, errorMessage, handleSignIn } = useLogin();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={styles.logo}
          />
          <Txt typography="t10" fontWeight="bold" textAlign="center" style={styles.title}>
            {t('auth.loginTitle')}
          </Txt>
          <Txt typography="t5" color="neutralSubtle" textAlign="center">
            {t('auth.loginSubtitle')}
          </Txt>
        </View>

        <View style={styles.actions}>
          <Button
            tone="neutral"
            size="large"
            display="block"
            loading={loading}
            onPress={handleSignIn}
            leftAccessory={<GoogleIcon size={20} />}
          >
            {t('auth.googleSignIn')}
          </Button>

          {errorMessage && (
            <Txt typography="t4" color="critical" textAlign="center">
              {errorMessage}
            </Txt>
          )}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SdsSpacing.x6,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SdsSpacing.x12,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: SdsRadius.r5,
    marginBottom: SdsSpacing.x5,
  },
  title: {
    marginBottom: SdsSpacing.x2,
  },
  actions: {
    gap: SdsSpacing.x3,
  },
}));
