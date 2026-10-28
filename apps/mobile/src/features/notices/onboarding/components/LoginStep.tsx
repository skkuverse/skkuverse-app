import { View } from 'react-native';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import {
  SdsSpacing,
  useT,
  type Campus,
  SdsRadius,
} from '@skkuverse/shared';
import type { TabSource } from '../../notices.types';

interface Props {
  campus: Campus;
  // WHY: null when the user had no department on step 2.
  primaryDeptId: string | null;
  interestDeptIds: string[];
  sources: TabSource[];
  loginError: string | null;
}

export function LoginStep({
  campus,
  primaryDeptId,
  interestDeptIds,
  sources,
  loginError,
}: Props) {
  const styles = useStyles();
  const { t } = useT();

  const campusName = campus === 'hssc'
    ? t('onboarding.hsscName')
    : t('onboarding.nscName');

  const primaryName = primaryDeptId
    ? (sources.find((s) => s.id === primaryDeptId)?.name ?? '')
    : t('onboarding.summaryPrimaryNone');
  const interestNames = interestDeptIds
    .map((id) => sources.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ') || t('onboarding.summaryNone');

  return (
    <View style={styles.container}>
      <Txt typography="t11" fontWeight="bold" color="neutral" style={styles.title}>
        {t('onboarding.loginTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" style={styles.subtitle}>
        {t('onboarding.loginSubtitle')}
      </Txt>

      <View style={styles.summaryCard}>
        <SummaryRow label={t('onboarding.summaryCampus')} value={campusName} />
        <SummaryRow label={t('onboarding.summaryPrimaryDept')} value={primaryName} />
        <SummaryRow label={t('onboarding.summaryInterestDept')} value={interestNames} />
      </View>

      <View style={styles.spacer} />

      {loginError && (
        <Txt typography="t3" color="critical" style={styles.error}>
          {loginError}
        </Txt>
      )}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.summaryRow}>
      <Txt typography="t3" color="placeholder" style={styles.summaryLabel}>
        {label}
      </Txt>
      <Txt
        typography="t3"
        fontWeight="medium"
        color="neutral"
        style={styles.summaryValue}
      >
        {value}
      </Txt>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
  },
  title: {
    marginTop: SdsSpacing.x2,
    marginBottom: SdsSpacing.x3_5,
  },
  subtitle: {
    marginBottom: SdsSpacing.x9,
  },
  summaryCard: {
    backgroundColor: color.bg.neutralMuted,
    borderRadius: SdsRadius.r4,
    // eslint-disable-next-line sds/no-spacing-literal -- the summary card's drawn inset, midway between x5 and x6; kept as drawn until a screenshot-reviewed batch picks one (2pt either way)
    padding: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SdsSpacing.x3,
    paddingVertical: SdsSpacing.x2,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    width: 72,
  },
  summaryValue: {
    flex: 1,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  error: {
    textAlign: 'center',
    marginBottom: SdsSpacing.x2,
  },
}));
