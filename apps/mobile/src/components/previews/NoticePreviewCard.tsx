import { StyleSheet, View } from 'react-native';
import { SparkleIcon } from 'phosphor-react-native';
import { createThemedStyles, useSemanticColors, Txt } from '@skkuverse/sds';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';

/**
 * WHY: the demo copy is hardcoded Korean, since one rich real example sells the summary better than a
 * placeholder; translate it before a launch outside Korea.
 */
export function NoticePreviewCard() {
  const styles = useStyles();
  const color = useSemanticColors();
  const brandStyles = useBrandStyles();

  return (
    <View style={styles.card}>
      <View style={styles.cardMeta}>
        <Txt typography="t1" fontWeight="medium" style={brandStyles.brandText}>교무팀</Txt>
        <View style={styles.cardBadge}>
          <Txt typography="t1" fontWeight="medium" style={styles.cardBadgeText}>D-3</Txt>
        </View>
      </View>
      <Txt typography="t4" fontWeight="medium" color="neutral" style={styles.cardTitle}>
        2026학년도 1학기 복수전공 이수신청
      </Txt>
      <View style={styles.aiBox}>
        <View style={styles.aiHeader}>
          <SparkleIcon size={11} color={color.fg.brandContrast} weight="regular" />
          <Txt typography="t1" fontWeight="medium" style={brandStyles.brandText}>AI 요약</Txt>
        </View>
        <Txt typography="t1" color="neutral">
          4/24까지 1차 신청, GLS에서 진행
        </Txt>
      </View>
      <View style={styles.detailRows}>
        <DetailRow label="신청기간" value="4/20 ~ 4/24" />
        <DetailRow label="대상" value="재학생·휴학생" />
        <DetailRow label="해야 할 일" value="GLS에서 신청" />
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Txt typography="t1" color="placeholder" style={styles.detailLabel}>
        {label}
      </Txt>
      <Txt typography="t1" color="neutral">
        {value}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  card: {
    width: '100%',
    backgroundColor: color.bg.layerDefault,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.stroke.neutralWeak,
    borderRadius: SdsRadius.r4,
    padding: SdsSpacing.x4,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SdsSpacing.x2_5,
  },
  cardBadge: {
    backgroundColor: color.bg.criticalWeak,
    // WHY: the SDS small badge's metrics, kept in step with it by hand.
    paddingVertical: SdsSpacing.x0_5,
    paddingHorizontal: SdsSpacing.x1_5,
    borderRadius: SdsRadius.r1_5,
  },
  cardBadgeText: {
    color: color.fg.criticalContrast,
  },
  cardTitle: {
    marginBottom: SdsSpacing.x3,
  },
  aiBox: {
    backgroundColor: color.bg.aiWeak,
    borderRadius: SdsRadius.r2_5,
    paddingVertical: SdsSpacing.x2_5,
    paddingHorizontal: SdsSpacing.x3,
    marginBottom: SdsSpacing.x3,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1,
    marginBottom: SdsSpacing.x1,
  },
  detailRows: {
    paddingTop: SdsSpacing.x1,
    gap: SdsSpacing.x1_5,
  },
  detailRow: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
  detailLabel: {
    minWidth: 56,
  },
}));

const useBrandStyles = createThemedStyles(({ color }) => ({
  brandText: {
    color: color.fg.brandContrast,
  },
}));
