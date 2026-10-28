import { StyleSheet, View } from 'react-native';
import { Button, Sheet, TextButton, Txt, useSheetBottomInset } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { GoogleIcon } from '@/components/GoogleIcon';

interface Props {
  open: boolean;
  variant: 'signIn' | 'setup';
  score: string;
  busy: boolean;
  error: string | null;
  onAccept(): void;
  onLater(): void;
}

/** WHY: asked once, after "next"; the result screen never nags, and declining simply carries on. */
export function RankPromptSheet({ open, variant, score, busy, error, onAccept, onLater }: Props) {
  const { t, tpl } = useT();
  const bottomInset = useSheetBottomInset();
  const signIn = variant === 'signIn';
  return (
    <Sheet open={open} position={{ kind: 'fit' }} surface="glass" backdrop onDismiss={onLater}>
      <Sheet.View style={[styles.content, { paddingBottom: CONTENT_BOTTOM_PAD + bottomInset }]}>
        <Txt typography="t10" fontWeight="bold" color="neutral" style={styles.title}>
          {t(signIn ? 'game.rankPrompt.signInTitle' : 'game.rankPrompt.nicknameTitle')}
        </Txt>
        <Txt typography="t5" color="neutralSubtle" style={styles.body}>
          {signIn ? t('game.rankPrompt.signInBody') : tpl('game.rankPrompt.body', score)}
        </Txt>
        {error && (
          <Txt typography="t3" color="critical" style={styles.error}>
            {error}
          </Txt>
        )}
        <View style={styles.actions}>
          {/* WHY: the same buttons, words and colours as every other sign-in and skip in the app. */}
          <Button
            tone={signIn ? 'neutral' : 'brand'}
            size="large"
            display="block"
            loading={busy}
            leftAccessory={signIn ? <GoogleIcon size={20} /> : undefined}
            onPress={onAccept}
          >
            {t(signIn ? 'auth.googleSignIn' : 'game.rankPrompt.nicknameCta')}
          </Button>
          <TextButton
            typography="t5"
            color="placeholder"
            fontWeight="medium"
            disabled={busy}
            onPress={onLater}
            style={styles.later}
          >
            {t('intro.loginSkip')}
          </TextButton>
        </View>
      </Sheet.View>
    </Sheet>
  );
}

const CONTENT_BOTTOM_PAD = 32;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x5,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: { marginBottom: SdsSpacing.x2 },
  body: { marginBottom: SdsSpacing.x6 },
  error: { marginTop: -SdsSpacing.x3, marginBottom: SdsSpacing.x4 },
  actions: { gap: SdsSpacing.x1 },
  later: { alignSelf: 'center', paddingVertical: SdsSpacing.x3 },
});
