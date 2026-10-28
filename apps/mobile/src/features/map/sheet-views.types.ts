import type { ComponentType, ReactNode, RefObject } from 'react';
import type { ScrollEventsHandlersHookType } from '@gorhom/bottom-sheet';
import type { SharedValue } from 'react-native-reanimated';
import type { TranslationKey } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import type { SheetRef } from '@skkuverse/sds';
import type { MapTabId } from './map-config.types';
import type { MapDetent } from './sheet-detents.constants';
import type { DetentPresentation, MapSheetProfileName } from './sheet-stack.constants';
import type { MapSheetEntryOf, MapSheetKind, MapSheetRequestOf } from './sheet-stack.types';

export interface MapSheetViewProps<K extends MapSheetKind> {
  tab: MapTabId;
  entry: MapSheetEntryOf<K>;
  fallback: ReactNode;
  /** WHY: its own prop rather than a field of `sheet`, whose identity stays put across levels. */
  presentation: DetentPresentation;
  /**
   * WHY: a view never opens the sheet; the stack moves it when the top body changes. Its identity changes only
   * when the stack does, never per detent. SEE: docs/explanation/shared-map.md
   */
  sheet: {
    lowerToReveal: () => void;
    dismiss: () => void;
    dismissAction: 'back' | 'close' | 'return';
    pageProgress: SharedValue<number>;
    bodyReveal: SharedValue<number>;
    scrollEvents: ScrollEventsHandlersHookType;
    /**
     * QUIRK(gorhom-bottom-sheet): below the top detent it locks the list, so the hold goes through the lock
     * (`list-hold.rules.ts`) without moving the sheet.
     */
    holdListAt: (y: number) => void;
  };
}

export interface MapSheetCardProps<K extends MapSheetKind> {
  tab: MapTabId;
  entry: MapSheetEntryOf<K>;
  sheetRef: RefObject<SheetRef | null>;
  bottomGap: number;
  onDismiss: () => void;
  onGone: () => void;
  onNavigateAway: () => void;
}

export interface MapSheetTrackingProps<K extends MapSheetKind> {
  tab: MapTabId;
  entry: MapSheetEntryOf<K>;
}

export interface MapSheetPlace {
  placeId: string;
  source: EntrySource;
  line?: { groupId: string; stationIndex: number };
}

/** WHY: `Tracking` stays mounted while the entry is on the stack, since a view remounts when the sheet above it pops. */
interface MapSheetKindDef<K extends MapSheetKind> {
  /** WHY: the place, never how it was reached, so the same key on top makes a push a no-op. */
  keyOf(request: MapSheetRequestOf<K>): string;
  fromPlace?(place: MapSheetPlace): MapSheetRequestOf<K> | null;
  layersFromFeed?: boolean;
  Tracking?: ComponentType<MapSheetTrackingProps<K>>;
}

export type MapSheetViewDef<K extends MapSheetKind> = MapSheetKindDef<K> &
  (
    | {
        presentation: 'swap';
        View: ComponentType<MapSheetViewProps<K>>;
        profile: MapSheetProfileName;
        openingOf?(request: MapSheetRequestOf<K>): MapDetent;
        label: TranslationKey;
      }
    | {
        presentation: 'over';
        View: ComponentType<MapSheetCardProps<K>>;
      }
  );

export type MapSheetViewTable = { readonly [K in MapSheetKind]: MapSheetViewDef<K> };
