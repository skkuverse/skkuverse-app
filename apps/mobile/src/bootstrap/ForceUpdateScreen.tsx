import { useEffect } from 'react';
import {
  BackHandler,
  Platform,
  View,
} from 'react-native';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { Button, Txt, createThemedStyles } from '@skkuverse/sds';
import { openExternalUrl } from '@/platform/handoff';

interface Props {
  updateUrl: string | null;
}

export function ForceUpdateScreen({ updateUrl }: Props) {
  const styles = useStyles();
  const { t } = useT();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handlePress = () => {
    if (updateUrl) {
      void openExternalUrl(updateUrl);
    }
  };

  return (
    <View style={styles.container}>
      <Txt typography="t10" fontWeight="bold" textAlign="center">
        {t('update.required')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" textAlign="center" style={styles.message}>
        {t('update.message')}
      </Txt>
      <Button tone="brand" size="medium" onPress={handlePress} viewStyle={styles.button}>
        {t('update.goToStore')}
      </Button>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color.bg.neutralMuted,
    padding: SdsSpacing.x6,
  },
  message: {
    marginTop: SdsSpacing.x2,
  },
  button: {
    alignSelf: 'center',
    marginTop: SdsSpacing.x6,
  },
}));

