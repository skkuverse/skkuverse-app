import { View } from 'react-native';
import { SdsPalette, useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, Txt } from '@skkuverse/sds';

interface LicensePlateProps {
  plateNumber: string | null;
  color: string;
}

export function LicensePlate({ plateNumber, color }: LicensePlateProps) {
  const styles = useStyles();
  const { t } = useT();
  const displayNumber = plateNumber?.match(/\d{4}$/)?.[0] ?? plateNumber ?? t('transit.noNumber');

  return (
    <View style={[styles.plate, { backgroundColor: color }]}>
      <Txt typography="t1" fontWeight="bold" style={styles.text}>{displayNumber}</Txt>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  plate: {
    paddingHorizontal: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x0_5,
    borderRadius: SdsRadius.r1,
    minWidth: 42,
    alignItems: 'center',
  },
  // WHY: the route color is data, so the text on it is static white in both schemes.
  text: {
    color: SdsPalette.static.white,
  },
}));
