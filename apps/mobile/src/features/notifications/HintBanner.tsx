import { StyleSheet } from 'react-native';
import { Callout } from '@skkuverse/sds';
import { SdsSpacing } from '@skkuverse/shared';

interface HintBannerProps {
  message: string;
}

export function HintBanner({ message }: HintBannerProps) {
  return <Callout description={message} style={styles.banner} />;
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: SdsSpacing.x4,
    marginTop: SdsSpacing.x3,
    marginBottom: SdsSpacing.x1,
  },
});
