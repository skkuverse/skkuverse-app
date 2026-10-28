import { View } from 'react-native';
import { CheckCircleIcon } from 'phosphor-react-native';
import { Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';

interface Props {
  userName: string;
}

export function CompletionStep({ userName }: Props) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t, tpl } = useT();
  const displayName = userName || '사용자';

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <CheckCircleIcon size={48} color={color.fg.positive} />
      </View>
      <Txt typography="t13" fontWeight="bold" color="neutral" style={styles.title}>
        {tpl('onboarding.completionTitle', displayName)}
      </Txt>
      <Txt typography="t5" color="neutralSubtle">
        {t('onboarding.completionSubtitle')}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    paddingTop: SdsSpacing.x12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: SdsRadius.full,
    backgroundColor: color.bg.positiveWeak,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SdsSpacing.x7,
  },
  title: {
    marginBottom: SdsSpacing.x3_5,
  },
}));
