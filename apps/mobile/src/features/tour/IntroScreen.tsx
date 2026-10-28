import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FixedBottomCTA, TextButton, Txt, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';

import { GoogleIcon } from '@/components/GoogleIcon';
import { IntroDots } from '@/features/tour/components/IntroDots';
import { IntroEmojiField } from '@/features/tour/components/IntroEmojiField';
import { IntroPage } from '@/features/tour/components/IntroPage';
import { ScreenshotFigure } from '@/features/tour/components/ScreenshotFigure';
import { useIntro } from './useIntro';

const SHUTTLE_SHOT = require('../../../assets/images/screenshots/shuttle.jpg');
const MAP_SHOT = require('../../../assets/images/screenshots/eskara-map.jpg');
const NOTICE_SHOT = require('../../../assets/images/screenshots/notice-detail.jpg');

interface Props {
  /** WHY: the only exit, since the caller marks `seen.intro` here; hardware back never dismisses. */
  onDone: () => void;
}

/**
 * WHY: a branch of `InitGate` that replaces `children`, never a route, so nothing mounts behind it and it is
 * no deep-link surface.
 */
export function IntroScreen({ onDone }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const {
    width,
    scrollRef,
    index,
    pageCount,
    signingIn,
    signInError,
    onLoginPage,
    handleMomentumEnd,
    handleAdvance,
    handleSkip,
    handleSignIn,
  } = useIntro(onDone);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <IntroDots count={pageCount} activeIndex={index} />

      {/* WHY: not a pager library, a native dependency that would need a prebuild and a runtimeVersion bump. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={!signingIn}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
      >
        <IntroPage
          width={width}
          title={t('intro.shuttleTitle')}
          body={t('intro.shuttleBody')}
          figure={<ScreenshotFigure source={SHUTTLE_SHOT} aspect={750 / 567} />}
        />
        <IntroPage
          width={width}
          title={t('intro.mapTitle')}
          body={t('intro.mapBody')}
          figure={<ScreenshotFigure source={MAP_SHOT} aspect={750 / 1533} />}
        />
        <IntroPage
          width={width}
          title={t('intro.noticesTitle')}
          body={t('intro.noticesBody')}
          figure={<ScreenshotFigure source={NOTICE_SHOT} aspect={750 / 678} />}
        />
        <IntroPage
          width={width}
          title={t('intro.loginTitle')}
          body={t('intro.loginBody')}
          figure={<IntroEmojiField />}
        />
      </ScrollView>

      <FixedBottomCTA>
        {onLoginPage ? (
          <>
            <Button
              tone="neutral"
              size="large"
              display="block"
              loading={signingIn}
              onPress={handleSignIn}
              leftAccessory={<GoogleIcon size={20} />}
            >
              {t('intro.loginCta')}
            </Button>
            <TextButton
              typography="t5"
              color="placeholder"
              fontWeight="medium"
              disabled={signingIn}
              onPress={handleSkip}
              style={styles.skipButton}
            >
              {t('intro.loginSkip')}
            </TextButton>
            {signInError ? (
              <Txt typography="t3" color="critical" style={styles.error}>
                {signInError}
              </Txt>
            ) : null}
          </>
        ) : (
          <Button tone="brand" size="large" display="block" onPress={handleAdvance}>
            {t('intro.next')}
          </Button>
        )}
      </FixedBottomCTA>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  pager: {
    flex: 1,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: SdsSpacing.x1,
    paddingVertical: SdsSpacing.x2,
  },
  error: {
    textAlign: 'center',
    marginTop: SdsSpacing.x2,
  },
}));
