import { View } from 'react-native';
import { BellRingingIcon } from 'phosphor-react-native';
import { Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';

export function NotificationStep() {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <BellRingingIcon size={48} color={color.fg.positive} weight="fill" />
      </View>
      <Txt
        typography="t13"
        fontWeight="bold"
        color="neutral"
        style={styles.title}
      >
        {t('onboarding.notificationTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle">
        {t('onboarding.notificationDescription')}
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
