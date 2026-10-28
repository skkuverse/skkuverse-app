/**
 * QUIRK(ios): the native bar keeps its Liquid Glass header items only without a `header` callback, so the
 * strip lives in the list's ListHeaderComponent, which keeps the list RNSScreen's subviews[0].
 * SEE: docs/explanation/ios-26-native-tabs-minimize.md
 */

import { StyleSheet, View } from 'react-native';
import { Tab, createThemedStyles } from '@skkuverse/sds';
import { useActiveNoticeTab } from '../useActiveNoticeTab';
import { logNoticesContentSelect } from '@/platform/analytics';
import { useNoticeTabs } from '../useNoticeTabs';

export function NoticesTabStrip() {
  const styles = useStyles();
  const { data: tabsConfig } = useNoticeTabs();
  const tabs = tabsConfig?.tabs ?? [];
  const { activeTabKey, setActiveTabKey } = useActiveNoticeTab();

  const handleTabChange = (key: string) => {
    if (key !== activeTabKey) {
      logNoticesContentSelect({ content_type: 'tab_strip', item_id: key });
    }
    setActiveTabKey(key);
  };

  return (
    <View style={styles.container}>
      {tabs.length > 0 ? (
        <Tab value={activeTabKey} onChange={handleTabChange} size="small" fluid>
          {tabs.map((tab) => (
            <Tab.Item key={tab.key} value={tab.key}>
              {tab.label}
            </Tab.Item>
          ))}
        </Tab>
      ) : (
        <View style={styles.tabPlaceholder} />
      )}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    backgroundColor: color.bg.layerDefault,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.stroke.neutralMuted,
  },
  tabPlaceholder: {
    height: 44,
  },
}));
