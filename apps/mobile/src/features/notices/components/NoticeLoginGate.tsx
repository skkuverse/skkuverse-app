import { SafeAreaView } from 'react-native-safe-area-context';
import { LockIcon } from 'phosphor-react-native';
import { ResultSection, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';

interface Props {
  description: string;
  onLoginPress: () => void;
}

export function NoticeLoginGate({ description, onLoginPress }: Props) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ResultSection
        asset={<LockIcon size={SdsSpacing.x10} color={color.fg.placeholder} />}
        description={description}
        primaryActionProps={{ children: t('auth.googleSignIn'), onPress: onLoginPress, tone: 'brand' }}
      />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
}));
