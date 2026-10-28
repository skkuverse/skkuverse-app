/** WHY: a page rather than a sheet on the map tab's stack: it is a list in time, not a place (ADR 0022 d2). */

import { ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles } from '@skkuverse/sds';
import { FeedEmpty } from './components/FeedEmpty';
import { FeedSections } from './components/FeedSections';
import { useThisWeekPage } from './useThisWeekPage';

export function ThisWeekScreen() {
  const styles = useStyles();
  const vm = useThisWeekPage();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: vm.title }} />
      {vm.isEmpty ? <FeedEmpty onOpenNotices={vm.onOpenNotices} /> : <FeedSections sections={vm.sections} onOpenRow={vm.onOpenRow} />}
    </ScrollView>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  page: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  content: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x14,
  },
}));
