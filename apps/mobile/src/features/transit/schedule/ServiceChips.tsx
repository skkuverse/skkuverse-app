import { startTransition, useOptimistic } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { Chip } from '@skkuverse/sds';
import { TossfaceRuns } from '@/components/TossfaceRuns';
import type { BusService } from '../transit.types';

const PARENT_INSET = SdsSpacing.gutter;

interface ServiceChipsProps {
  services: BusService[];
  selectedId: string | undefined;
  /**
   * WHY: called inside a transition so the screen renders after the chip moved; a store read with
   * useSyncExternalStore must not be written from here, as that update is never a transition.
   */
  onSelect: (serviceId: string) => void;
}

export function ServiceChips({ services, selectedId, onSelect }: ServiceChipsProps) {
  const [shownId, showId] = useOptimistic(selectedId);

  const select = (serviceId: string) =>
    startTransition(() => {
      showId(serviceId);
      onSelect(serviceId);
    });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <Chip.RadioRoot value={shownId} onValueChange={select} style={styles.row}>
        {services.map((service) => (
          <Chip.RadioItem key={service.serviceId} value={service.serviceId} variant="outlineWeak" tone="brand">
            <Chip.Label>
              <TossfaceRuns text={service.label} />
            </Chip.Label>
          </Chip.RadioItem>
        ))}
      </Chip.RadioRoot>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // WHY: runs edge to edge across the card's inset, then pads inside, so the last chip clips at the screen edge.
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
