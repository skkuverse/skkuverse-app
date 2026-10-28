import { ScrollView, StyleSheet } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Chip } from '@skkuverse/sds';

// WHY: the row runs edge to edge across the header's inset, so the last chip is cut at the screen edge.
const PARENT_INSET = SdsSpacing.gutter;

export function CafeteriaChips({
  cafeterias,
  selectedId,
  onSelect,
}: {
  cafeterias: { id: string; title: string }[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      <Chip.RadioRoot value={selectedId} onValueChange={onSelect} style={styles.row}>
        {cafeterias.map((cafeteria) => (
          <Chip.RadioItem key={cafeteria.id} value={cafeteria.id} variant="outlineWeak" tone="brand">
            <Chip.Label>{cafeteria.title}</Chip.Label>
          </Chip.RadioItem>
        ))}
      </Chip.RadioRoot>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginHorizontal: -PARENT_INSET,
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: PARENT_INSET,
  },
  row: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
});
