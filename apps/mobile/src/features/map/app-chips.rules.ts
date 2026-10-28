/**
 * WHY: ordinary `link` chips the app adds until the server serves them, so moving one to `/map/config`
 * deletes it here alone. Ids carry an `app.` prefix, which no served snake_case id can, so analytics
 * tells them apart.
 */

import { t, type AppLanguage, type Campus, type TranslationKey } from '@skkuverse/shared';
import { CAMPUS_ROUTE_IDS } from '@/features/campus-routes/campus-routes.constants';
import type { MapChip, MapChipIcon } from './map-config.types';

export interface AppChipInputs {
  lang: AppLanguage;
  campus: Campus;
  directionsEnabled: boolean;
}

const DIRECTIONS_LABEL = { hssc: 'map.chip.toNsc', nsc: 'map.chip.toHssc' } as const satisfies Record<
  Campus,
  TranslationKey
>;

const emoji = (glyph: string): MapChipIcon => ({ kind: 'emoji', emoji: glyph });

function linkChip(id: string, label: string, icon: MapChipIcon, route: string): MapChip {
  return {
    id,
    label,
    icon,
    action: { kind: 'link', actionType: 'route', actionValue: route },
    isReset: false,
    list: null,
    tabs: ['map', 'transit'],
  };
}

export function appChips({ lang, campus, directionsEnabled }: AppChipInputs): MapChip[] {
  return [
    ...(directionsEnabled
      ? [linkChip('app.directions', t(lang, DIRECTIONS_LABEL[campus]), emoji('\u{1F68C}'), `/routes/${CAMPUS_ROUTE_IDS[campus]}`)]
      : []),
    linkChip('app.meals', t(lang, 'meals.title'), emoji('\u{1F35A}'), '/meals'),
  ];
}

export function withAppChips(served: readonly MapChip[], app: readonly MapChip[]): MapChip[] {
  return [...app, ...served];
}
