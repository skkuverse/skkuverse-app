import { useMemo } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { NoticeListPanel } from './NoticeListPanel';
import { createThemedStyles } from '@skkuverse/sds';
import { useNoticeTabs } from './useNoticeTabs';
import { toSourceName } from './notices.rules';

interface Props {
  sourceId: string;
}

export function NoticeListScreen({ sourceId }: Props) {
  const styles = useStyles();
  const { t } = useT();
  const { data: tabsConfig } = useNoticeTabs();

  const sourceName = useMemo(() => toSourceName(tabsConfig, sourceId), [tabsConfig, sourceId]);

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
