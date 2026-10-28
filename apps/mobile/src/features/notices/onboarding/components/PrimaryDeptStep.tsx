import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SearchField, Txt } from '@skkuverse/sds';
import {
  useT,
  type Campus,
  SdsSpacing,
} from '@skkuverse/shared';
import { DeptRow } from '../DeptRow';
import { UnsupportedDeptSheet } from '../UnsupportedDeptSheet';
import { logOnboardingStep } from '@/platform/analytics';
import { findCollegeUmbrella } from '../../college-recommendation.rules';
import { isUnsupportedSource } from '../../source-filters.rules';
import type { TabSource } from '../../notices.types';

interface Props {
  campus: Campus;
  sources: TabSource[];
  selectedId: string | null;
  onSelect: (deptId: string) => void;
}

export function PrimaryDeptStep({
  campus,
  sources: sourceDepartments,
  selectedId,
  onSelect,
}: Props) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [unsupportedTapped, setUnsupportedTapped] = useState<TabSource | null>(null);

  const departments = useMemo(() => {
    // WHY: the server may send a null campus for an any-campus entry.
    const filtered = sourceDepartments.filter(
      (d) => d.campus === campus || d.campus === 'both' || d.campus == null,
    );
    if (!query.trim()) return filtered;
    return filtered.filter((d) => d.name.includes(query.trim()));
  }, [campus, sourceDepartments, query]);

  const umbrella = useMemo(
    () => (unsupportedTapped ? findCollegeUmbrella(unsupportedTapped, sourceDepartments) : null),
    [unsupportedTapped, sourceDepartments],
  );

  const handleRowPress = (item: TabSource) => {
    if (isUnsupportedSource(item)) {
      logOnboardingStep({
        step: 'primary_dept',
        action: 'open_unsupported_sheet',
        detail: item.id,
      });
      setUnsupportedTapped(item);
      return;
    }
    logOnboardingStep({
      step: 'primary_dept',
      action: 'select_primary_dept',
      detail: item.id,
    });
    onSelect(item.id);
  };

  return (
    <View style={styles.container}>
      <Txt typography="t11" fontWeight="bold" color="neutral" style={styles.title}>
        {t('onboarding.primaryDeptTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" style={styles.subtitle}>
        {t('onboarding.primaryDeptSubtitle')}
      </Txt>
      <SearchField
        placeholder={t('onboarding.deptSearchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        hasClearButton
        style={styles.search}
      />
      <FlatList
        data={departments}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <DeptRow
            name={item.name}
            selected={item.id === selectedId}
            unsupported={!item.noticeAvailable}
            variant="radio"
            onPress={() => handleRowPress(item)}
          />
        )}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <UnsupportedDeptSheet
        source={unsupportedTapped}
        umbrella={umbrella}
        onAccept={(picked) => {
          setUnsupportedTapped(null);
          onSelect(picked.id);
        }}
        onDismiss={() => setUnsupportedTapped(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  search: {
    marginBottom: SdsSpacing.x3,
  },
  list: {
    flex: 1,
    marginHorizontal: -SdsSpacing.x1,
  },
});
