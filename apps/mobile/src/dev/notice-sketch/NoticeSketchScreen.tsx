import { SectionList, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SdsSpacing } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { SKETCH_DAY_LABEL, SKETCH_ROWS, sketchDetailFor } from './notice-sketch.constants';
import type { SketchDay, SketchRow } from './notice-sketch.types';
import { SketchDetailView } from './SketchDetailView';
import { SketchRowItem } from './SketchRowItem';

const DAYS: SketchDay[] = ['today', 'yesterday', 'thisWeek', 'earlier'];

const SECTIONS = DAYS.map((day) => ({
  day,
  data: SKETCH_ROWS.filter((row) => row.day === day),
})).filter((section) => section.data.length > 0);

export function NoticeSketchScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const detail = id ? sketchDetailFor(id) : null;
  if (detail) {
    return (
      <>
        <Stack.Screen options={{ title: detail.board }} />
        <SketchDetailView detail={detail} />
      </>
    );
  }
  return <SketchList />;
}

function SketchList() {
  const styles = useStyles();
  const open = (row: SketchRow) => router.push({ pathname: '/notice-sketch', params: { id: row.id } } as never);
  return (
    <>
      <Stack.Screen options={{ title: '공지 행 스케치' }} />
      <SectionList
        sections={SECTIONS}
        keyExtractor={(row) => row.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        renderSectionHeader={({ section }) => (
          <View style={styles.header}>
            <Txt typography="t3" fontWeight="bold" color="neutralSubtle">
              {SKETCH_DAY_LABEL[section.day]}
            </Txt>
          </View>
        )}
        renderItem={({ item }) => <SketchRowItem row={item} onPress={open} />}
      />
    </>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  content: {
    paddingBottom: SdsSpacing.x10,
    backgroundColor: color.bg.layerDefault,
  },
  header: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x5,
    paddingBottom: SdsSpacing.x1,
  },
}));
