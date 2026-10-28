import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretLeftIcon } from 'phosphor-react-native';
import {
  Button,
  FixedBottomCTA,
  IconButton,
  TextButton,
  Txt, useSemanticColors, createThemedStyles,
} from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';

interface Props {
  onBack: () => void;
  backLabel: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaPress: () => void;
  ctaContent?: ReactNode;
  secondaryAction?: { label: string; onPress: () => void };
  ctaFineprint?: string;
  minimal?: boolean;
  children: ReactNode;
}

export function OnboardingLayout({
  onBack,
  backLabel,
  ctaLabel,
  ctaDisabled = false,
  onCtaPress,
  ctaContent,
  secondaryAction,
  ctaFineprint,
  minimal = false,
  children,
}: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!minimal && (
        <View style={styles.topBar}>
          <IconButton
            icon={<CaretLeftIcon size={22} color={color.fg.neutral} />}
            onPress={onBack}
            label={backLabel}
          />
        </View>
      )}

      <View style={styles.content}>{children}</View>

      <FixedBottomCTA
        flushOnKeyboard
        below={
          <Fragment>
            {secondaryAction && (
              <TextButton
                typography="t5"
                color="placeholder"
                fontWeight="medium"
                onPress={secondaryAction.onPress}
                style={styles.secondaryButton}
              >
                {secondaryAction.label}
              </TextButton>
            )}
            {ctaFineprint && (
              <Txt typography="t3" color="placeholder" style={styles.fineprint}>
                {ctaFineprint}
              </Txt>
            )}
          </Fragment>
        }
      >
        {({ keyboardVisible }) =>
          ctaContent ?? (
            <Button
              tone="brand"
              size="large"
              display={keyboardVisible ? 'full' : 'block'}
              disabled={ctaDisabled}
              onPress={onCtaPress}
            >
              {ctaLabel}
            </Button>
          )
        }
      </FixedBottomCTA>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.x3,
  },
  content: {
    flex: 1,
    paddingHorizontal: SdsSpacing.x6,
    paddingTop: SdsSpacing.x3,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  secondaryButton: {
    alignSelf: 'center',
    marginTop: SdsSpacing.x1,
    paddingVertical: SdsSpacing.x2,
  },
  fineprint: {
    textAlign: 'center',
    marginTop: SdsSpacing.x2,
  },
}));
