import { ScrollView, StyleSheet, View } from 'react-native';
import { ResultSection, Txt } from '@skkuverse/sds';
import { SdsSpacing, useT } from '@skkuverse/shared';
import { TabToggleRow } from '@/features/notifications/TabToggleRow';
import { useNoticeCategoriesStep } from './useNoticeCategoriesStep';

/**
 * WHY: until the seed's listener mirror arrives, every tab shows on, which matches the seed, since the
 * functions derive an undefined toggle as on.
 */
export function NoticeCategoriesStep() {
  const { t } = useT();
  const { tabsConfig, tabsLoading, tabsError, refetchTabs, handleToggle, isOn } =
    useNoticeCategoriesStep();

  return (
    <View style={styles.container}>
      <Txt
        typography="t13"
        fontWeight="bold"
        color="neutral"
        style={styles.title}
      >
        {t('onboarding.categoriesTitle')}
      </Txt>
      <Txt typography="t5" color="neutralSubtle" style={styles.subtitle}>
        {t('onboarding.categoriesSubtitle')}
      </Txt>

      <ScrollView
        style={styles.listFlex}
        contentContainerStyle={styles.listInner}
        showsVerticalScrollIndicator={false}
      >
        {tabsConfig?.tabs.map((tab) => (
          <TabToggleRow
            key={tab.key}
            tab={tab}
            checked={isOn(tab.key)}
            onChange={(v) => handleToggle(tab.key, v)}
            disabled={false}
          />
        ))}

        {tabsError && !tabsLoading && (
          <ResultSection
            size="medium"
            description={t('notifications.loadError')}
            primaryActionProps={{ children: t('notifications.retry'), onPress: () => refetchTabs() }}
            style={styles.retryBlock}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SdsSpacing.x4,
  },
  title: {
    marginBottom: SdsSpacing.x2,
  },
  subtitle: {
    marginBottom: SdsSpacing.x4,
  },
  listFlex: {
    flex: 1,
    // WHY: cancels OnboardingLayout's padding, so TabToggleRow's own 24 matches the settings screen.
    marginHorizontal: -SdsSpacing.x6,
  },
  listInner: {
    paddingBottom: SdsSpacing.x6,
  },
  retryBlock: {
    paddingVertical: SdsSpacing.x6,
  },
});
