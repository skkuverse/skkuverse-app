import { floorBadge, getLocalizedText, type AppLanguage, type TranslationKey } from '@skkuverse/shared';
import type { AccordionSection } from '@skkuverse/sds';
import type { BuildingConnection, FloorInfo, FloorSpace } from '../building.types';

type Template = (key: TranslationKey, ...args: (string | number)[]) => string;

interface ConnectionChip {
  label: string;
  targetSkkuId: number;
}

export function floorIndexOfSpace(floors: FloorInfo[], spaceCd: string | undefined): number | null {
  if (!spaceCd) return null;
  const index = floors.findIndex((f) => f.spaces.some((s) => s.spaceCd === spaceCd));
  return index >= 0 ? index : null;
}

export function toFloorSections(floors: FloorInfo[], lang: AppLanguage, tpl: Template): AccordionSection<FloorSpace>[] {
  return floors.map((f) => {
    const name = getLocalizedText(f.floor, lang);
    return {
      title: name,
      subtitle: tpl('building.unitCount', f.spaces.length),
      badge: floorBadge(name),
      items: f.spaces,
    };
  });
}

export function toChipsByFloorBadge(
  connections: BuildingConnection[],
  lang: AppLanguage,
): Record<string, ConnectionChip[]> {
  const map = Object.create(null) as Record<string, ConnectionChip[]>;
  for (const conn of connections) {
    const fromFloorText = getLocalizedText(conn.fromFloor, lang);
    const fromBadge = floorBadge(fromFloorText);
    const targetName = getLocalizedText(conn.targetName, lang);
    const toFloor = getLocalizedText(conn.toFloor, lang);
    const label = `${targetName} ${floorBadge(toFloor)}`;
    if (!map[fromBadge]) map[fromBadge] = [];
    map[fromBadge].push({ label, targetSkkuId: conn.targetSkkuId });
  }
  return map;
}
