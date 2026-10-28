import { View } from 'react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, Txt } from '@skkuverse/sds';

interface TopInfoBarProps {
  totalBuses: number;
  serviceOver: boolean;
  noInfo: boolean;
}

export function TopInfoBar({ totalBuses, serviceOver, noInfo }: TopInfoBarProps) {
  const styles = useStyles();
  const { t, tpl } = useT();
  return (
    <View style={styles.container}>
      <Txt typography="t2" style={styles.text}>
        {serviceOver
          ? t('realtime.serviceOver')
          : noInfo
            ? t('realtime.arrival.noInfo')
            : tpl('realtime.infoBar', totalBuses)}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    backgroundColor: color.bg.neutralMuted,
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x2,
  },
  text: {
    color: color.fg.neutralMuted,
  },
}));
