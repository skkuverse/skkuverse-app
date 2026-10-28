import { View } from 'react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, Txt } from '@skkuverse/sds';

export function HsscCreditScreen() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Txt typography="t3" fontWeight="bold" style={styles.cardTitle}>
            인사캠 건물지도 &apos;빠를지도&apos; 제공
          </Txt>
          <View style={styles.cardSpacer} />
          <Txt typography="t3">
            @문화예술캡스톤디자인 2조{'\n'}김찬호 김서연 전윤아 왕희문 손주연
            신해령
          </Txt>
        </View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    paddingHorizontal: SdsSpacing.x4,
    paddingTop: SdsSpacing.x5,
  },
  card: {
    backgroundColor: color.bg.neutralWeak,
    borderRadius: SdsRadius.r2_5,
    padding: SdsSpacing.x3,
  },
  cardTitle: {
    color: color.fg.neutral,
  },
  cardSpacer: {
    height: 3,
  },
}));
