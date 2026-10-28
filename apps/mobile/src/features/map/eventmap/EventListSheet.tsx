import { useViewTracking } from '@/platform/analytics';
import { EventListPanel } from './EventListPanel';
import { ListFacetSheet } from './ListFacetSheet';
import { useEventList } from './useEventList';
import { useEventListRows } from './useEventListRows';
import type { MapSheetTrackingProps, MapSheetViewProps } from '../sheet-views.types';

export function EventListSheet({ tab, entry, fallback, sheet }: MapSheetViewProps<'chip'>) {
  const {
    showList,
    listedPlaces,
    list,
    facetSelection,
    openFacet,
    facetSheetRef,
    onOpenFacet,
    onSelectFacet,
    onSelectPlace,
    now,
    bottomPadding,
    bottomGap,
  } = useEventList(tab, entry);

  if (!showList) return fallback;

  return (
    <>
      <EventListPanel
        places={listedPlaces}
        list={list}
        selection={facetSelection}
        onOpenFacet={onOpenFacet}
        bottomPadding={bottomPadding}
        now={now}
        onSelectPlace={onSelectPlace}
      />
      <ListFacetSheet
        ref={facetSheetRef}
        facet={openFacet}
        held={openFacet ? (facetSelection[openFacet.id] ?? []) : []}
        onChange={onSelectFacet}
        bottomGap={bottomGap}
      />
    </>
  );
}

/** WHY: as `Tracking` it lives as long as the chip entry, so opening a place and backing out logs no second open. */
export function EventListTracking({ entry }: MapSheetTrackingProps<'chip'>) {
  const { showList } = useEventListRows(entry);
  useViewTracking('event_list', showList ? entry.request.chipId : null, 'chip');
  return null;
}

/** WHY: the native tabs' list logs while mounted; its place opens as a card above it, so it never swaps out. */
export function EventListSheetTracked(props: MapSheetViewProps<'chip'>) {
  return (
    <>
      <EventListTracking tab={props.tab} entry={props.entry} />
      <EventListSheet {...props} />
    </>
  );
}
