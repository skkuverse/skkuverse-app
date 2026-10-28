import type { Campus, LocalizedText } from '@skkuverse/shared';
import type { MapTabId } from '../map-config.types';

export interface BuildingImage {
  url: string;
  filename: string;
}

export interface Accessibility {
  elevator: boolean;
  toilet: boolean;
}

export interface Building {
  skkuId: number;
  buildNo?: string;
  displayNo?: string;
  type: string; // CONTRACT(skkuverse-server): skkuverse-server/src/building/ sends "building" or "facility"
  campus: Campus;
  campusLabel: string;
  name: LocalizedText;
  description?: LocalizedText;
  lat: number;
  lng: number;
  image?: BuildingImage;
  accessibility?: Accessibility;
  attachments: unknown[];
}

export interface FloorSpace {
  spaceCd: string;
  name: LocalizedText;
  conspaceCd?: string;
}

export interface FloorInfo {
  floor: LocalizedText;
  spaces: FloorSpace[];
}

export interface BuildingConnection {
  targetSkkuId: number;
  targetBuildNo?: string;
  targetDisplayNo?: string;
  targetName: LocalizedText;
  fromFloor: LocalizedText;
  toFloor: LocalizedText;
}

export interface BuildingDetail {
  building: Building;
  floors: FloorInfo[];
  connections: BuildingConnection[];
}

export interface SearchSpaceItem {
  spaceCd: string;
  name: LocalizedText;
  floor: LocalizedText;
}

export interface SpaceGroup {
  skkuId?: number;
  buildNo: string;
  displayNo?: string;
  /** WHY: a space result has no campus, so null means the API did not say. */
  campus: Campus | null;
  campusLabel: string;
  buildingName: LocalizedText;
  items: SearchSpaceItem[];
}

export interface CampusCounts {
  hssc: number;
  nsc: number;
  total: number;
}

export interface SearchCounts {
  building: CampusCounts;
  space: CampusCounts;
}

export interface BuildingSearchResult {
  keyword: string;
  buildingCount: number;
  spaceCount: number;
  buildings: Building[];
  spaces: SpaceGroup[];
  counts: SearchCounts;
}

/** WHY: no coordinates; the building's sheet frames it from its own detail. */
export interface MapNavPayload {
  kind: 'building';
  skkuId: number;
  highlightFloor?: string;
  highlightSpaceCd?: string;
  tab: MapTabId;
}
