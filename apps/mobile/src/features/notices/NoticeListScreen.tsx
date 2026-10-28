import { useMemo } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { NoticeListPanel } from './NoticeListPanel';
import { createThemedStyles } from '@skkuverse/sds';
import { useNoticeTabs } from './useNoticeTabs';

interface Props {
  sourceId: string;
}

export function NoticeListScreen({ sourceId }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const { data: tabsConfig } = useNoticeTabs();

  const sourceName = useMemo(() => {
    if (!tabsConfig) return null;
    for (const tab of tabsConfig.tabs) {
      if (tab.tabMode === 'fixed' && tab.fixed?.sourceId === sourceId) return tab.fixed.name;
      if (tab.tabMode === 'picker' && tab.picker) {
        const source = tab.picker.sources.find((s) => s.id === sourceId);
        if (source) return source.name;
      }
    }
    return null;
  }, [tabsConfig, sourceId]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: sourceName ?? t('notices.title') }} />
      <NoticeListPanel sourceId={sourceId} />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerBasement,
  },
}));
