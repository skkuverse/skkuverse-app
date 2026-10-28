import { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { SearchField, Toast, Txt, createThemedStyles } from '@skkuverse/sds';
import {
  useT,
  type Campus,
  SdsRadius,
  SdsSpacing,
  withAlpha,
} from '@skkuverse/shared';
import { MAX_INTEREST_DEPTS } from '../onboarding.rules';
import { DeptRow } from '../DeptRow';
import { logOnboardingStep } from '@/platform/analytics';
import { isUnsupportedSource } from '../../source-filters.rules';
import { recommendCollegeMates } from '../../college-recommendation.rules';
import type { TabSource } from '../../notices.types';

interface Props {
  campus: Campus;
  // WHY: null when the user had no department on the previous step.
  primaryDeptId: string | null;
  sources: TabSource[];
  selectedIds: string[];
  onToggle: (deptId: string) => void;
}

interface DeptSection {
  title: string;
  data: TabSource[];
}

export function InterestDeptStep({
  campus,
  primaryDeptId,
  sources: sourceDepartments,
  selectedIds,
  onToggle,
}: Props) {
  const styles = useStyles();
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [toastText, setToastText] = useState<string | null>(null);
  const atMax = selectedIds.length >= MAX_INTEREST_DEPTS;

  const primaryDept = primaryDeptId
    ? sourceDepartments.find((d) => d.id === primaryDeptId)
    : undefined;

  const candidates = useMemo(() => {
    const filtered = sourceDepartments.filter(
      (d) =>
        d.id !== primaryDeptId &&
        (d.campus === campus || d.campus === 'both' || d.campus == null),
    );
    if (!query.trim()) return filtered;
    return filtered.filter((d) => d.name.includes(query.trim()));
  }, [campus, primaryDeptId, sourceDepartments, query]);

  const sections: DeptSection[] = useMemo(() => {
    const { recommended, others } = recommendCollegeMates(primaryDept ?? null, candidates);
    const out: DeptSection[] = [];
    if (recommended.length > 0) {
      out.push({ title: t('onboarding.interestDept.recommendedSection'), data: recommended });
    }
    out.push({
      title: recommended.length > 0 ? t('onboarding.interestDept.othersSection') : '',
      data: others,
    });
    return out;
  }, [primaryDept, candidates, t]);

  const handleRowPress = (item: TabSource) => {
    if (isUnsupportedSource(item)) {
      setToastText(t('onboarding.unsupportedDept.toast'));
      return;
    }
    logOnboardingStep({
      step: 'interest_dept',
      action: 'toggle_interest_dept',
      detail: item.id,
    });
    onToggle(item.id);
  };

  return (
    <View style={styles.container}>
      <Txt typography="t11" fontWeight="bold" color="neutral" style={styles.title}>
        {t('onboarding.interestDeptTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" style={styles.subtitle}>
        {t('onboarding.interestDeptSubtitle')}
      </Txt>

      {primaryDept && (
        <View style={styles.pinnedCard}>
          <Txt typography="t5" fontWeight="semiBold" color="brandContrast">
            {primaryDept.name}
          </Txt>
          <View style={styles.pinnedTag}>
            <Txt typography="t3" fontWeight="bold" color="brandContrast">
              {t('onboarding.primaryTag')}
            </Txt>
          </View>
        </View>
      )}

      <SearchField
        placeholder={t('onboarding.deptSearchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        hasClearButton
        style={styles.search}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          const unsupported = !item.noticeAvailable;
          return (
            <DeptRow
              name={item.name}
              selected={isSelected}
              // WHY: the cap applies only to supported rows; an unsupported tap opens an explanation, not a selection.
              disabled={!unsupported && atMax && !isSelected}
              unsupported={unsupported}
              variant="checkbox"
              onPress={() => handleRowPress(item)}
            />
          );
        }}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Txt
              typography="t3"
              fontWeight="semiBold"
              color="neutralSubtle"
              style={styles.sectionHeader}
            >
              {section.title}
            </Txt>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <Toast
        open={toastText !== null}
        text={toastText ?? ''}
        onClose={() => setToastText(null)}
      />
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
    marginBottom: SdsSpacing.x6,
  },
  pinnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bg.positiveWeak,
    borderRadius: SdsRadius.r3,
    padding: SdsSpacing.x3_5,
    paddingHorizontal: SdsSpacing.x4,
    marginBottom: SdsSpacing.x3_5,
    gap: SdsSpacing.x2,
  },
  pinnedTag: {
    // WHY: the CTA green at 12% over bg.positiveWeak, since no role is a tint of a tint.
    backgroundColor: withAlpha(color.bg.brandSolid, 0.12),
    paddingHorizontal: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x0_5,
    borderRadius: SdsRadius.r1,
  },
  search: {
    marginBottom: SdsSpacing.x3,
  },
  list: {
    flex: 1,
    marginHorizontal: -SdsSpacing.x1,
  },
  sectionHeader: {
    paddingHorizontal: SdsSpacing.x3,
    paddingTop: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x1_5,
  },
}));
