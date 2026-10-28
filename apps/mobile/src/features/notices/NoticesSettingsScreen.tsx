import { ScrollView, View } from 'react-native';
import { ListRow, ResultSection, Switch, createThemedStyles } from '@skkuverse/sds';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { AnonymousGate } from '@/features/notifications/AnonymousGate';
import { EnableNotificationsSheet } from '@/features/notifications/EnableNotificationsSheet';
import { HintBanner } from '@/features/notifications/HintBanner';
import { TabToggleRow } from '@/features/notifications/TabToggleRow';
import { useNoticesSettings } from './useNoticesSettings';

export default function NoticesSettingsScreen() {
  const styles = useStyles();
  const { t } = useT();
  const {
    authReady,
    enableSheetRef,
    masterEnabled,
    noticesEnabled,
    togglesDisabled,
    tabsConfig,
    tabsLoading,
    tabsError,
    refetchTabs,
    handleToggleCategory,
    handleToggleNoticeTab,
    isNoticeTabOn,
  } = useNoticesSettings();

  if (!authReady) return <AnonymousGate />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!masterEnabled && <HintBanner message={t('notifications.masterOffHint')} />}
        {masterEnabled && !noticesEnabled && (
          <HintBanner message={t('notifications.noticesCategoryOffHint')} />
        )}

        <ListRow
          contents={
            <ListRow.Texts
              layout="1RowTypeA"
              top={t('notifications.noticesDetailSwitchLabel')}
            />
          }
          right={
            <Switch
              checked={noticesEnabled}
              onCheckedChange={handleToggleCategory}
              disabled={togglesDisabled}
            />
          }
        />

        {tabsConfig?.tabs.map((tab) => (
          <TabToggleRow
            key={tab.key}
            tab={tab}
            checked={isNoticeTabOn(tab.key)}
            onChange={(v) => handleToggleNoticeTab(tab.key, v)}
            disabled={togglesDisabled}
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

      <EnableNotificationsSheet ref={enableSheetRef} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  // WHY: a scrolling screen ends on x14 of bottom space (SPACE-07).
  scroll: {
    paddingBottom: SdsSpacing.x14,
  },
  retryBlock: {
    paddingVertical: SdsSpacing.x6,
  },
}));
