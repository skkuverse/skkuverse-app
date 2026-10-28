// WHY: a name usually stands for two poles on opposite curbs, so a result is a name and each pole a sub-row told apart by its next stop.
// Only served names are matched; a Jongno pole is named in Korean in every language and stays so.
import { pickI18nText, type AppLanguage, type Campus, type I18nText, type TranslationKey } from '@skkuverse/shared';
import type { CampusCounts, SearchCounts } from '@/features/map/building/building.types';
import type { SubwayStation } from '@/features/transit/subway/subway.types';
import type { BusStop } from '@/features/transit/transit.types';

export type StopDirection = { kind: 'towards'; name: string } | { kind: 'terminal' };

export interface StopPoleResult {
  stopId: string;
  directions: readonly StopDirection[];
  routeLabels: readonly string[];
}

export interface StopNameResult {
  key: string;
  name: string;
  campus: Campus | null;
  poles: readonly StopPoleResult[];
}

// WHY: the served names mix spacing and separators freely ("Hyehwa Stn Exit 1" beside "Hyehwa StnExit 1", "Angukseonwon.Samgeori"), so case, spaces and separators are dropped.
function matchForm(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/[\s.·,()-]/g, '');
}

function servedNames(name: I18nText): string[] {
  return [name.ko, name.en, ...(name.zh ? [name.zh] : [])].map(matchForm);
}

/**
 * WHY: live routes only, since a stop served by timetable shuttles alone is a boarding spot
 * and how those join the map is deferred.
 */
function isListed(stop: BusStop): boolean {
  return stop.routes.some((r) => r.kind === 'live');
}

function directionsOf(stop: BusStop, lang: AppLanguage): StopDirection[] {
  const directions: StopDirection[] = [];
  const seen = new Set<string>();
  for (const route of stop.routes) {
    if (route.kind !== 'live') continue;
    const direction: StopDirection = route.towards
      ? { kind: 'towards', name: pickI18nText(route.towards, lang) }
      : { kind: 'terminal' };
    const id = direction.kind === 'towards' ? `towards:${direction.name}` : 'terminal';
    if (seen.has(id)) continue;
    seen.add(id);
    directions.push(direction);
  }
  return directions;
}

function routeLabelsOf(stop: BusStop, lang: AppLanguage): string[] {
  return [...new Set(stop.routes.map((r) => pickI18nText(r.label, lang)))];
}

export function searchStops(stops: readonly BusStop[], query: string, lang: AppLanguage): StopNameResult[] {
  const q = matchForm(query);
  if (q === '') return [];

  const results = new Map<string, StopNameResult & { prefix: boolean; poles: StopPoleResult[] }>();
  for (const stop of stops) {
    if (!isListed(stop)) continue;
    const names = servedNames(stop.name);
    if (!names.some((n) => n.includes(q))) continue;

    const name = pickI18nText(stop.name, lang);
    const key = `${stop.campus ?? ''}:${matchForm(name)}`;
    const pole: StopPoleResult = {
      stopId: stop.id,
      directions: directionsOf(stop, lang),
      routeLabels: routeLabelsOf(stop, lang),
    };
    const prefix = names.some((n) => n.startsWith(q));
    const result = results.get(key);
    if (result) {
      result.poles.push(pole);
      result.prefix ||= prefix;
    } else {
      results.set(key, { key, name, campus: stop.campus, poles: [pole], prefix });
    }
  }

  const ordered = [...results.values()];
  // WHY: array sort is stable, so the served order survives within each rank.
  ordered.sort((a, b) => Number(b.prefix) - Number(a.prefix));
  return ordered.map(({ prefix: _prefix, ...result }) => result);
}

// WHY: only the served title is matched, which follows `Accept-Language`.
export function searchStations(stations: readonly SubwayStation[], query: string): SubwayStation[] {
  const q = matchForm(query);
  if (q === '') return [];
  const matching = stations.filter((s) => matchForm(s.title).includes(q));
  const prefix = (s: SubwayStation) => Number(matchForm(s.title).startsWith(q));
  return matching.sort((a, b) => prefix(b) - prefix(a));
}

// WHY: a station with no campus reads as both.
export function stationsOnCampus(stations: readonly SubwayStation[], campus: Campus | undefined): SubwayStation[] {
  return stations.filter((s) => campus === undefined || s.campus === null || s.campus === campus);
}

export type SearchSection = 'buildings' | 'stops' | 'stations' | 'spaces';

export function dividedSections(shown: Readonly<Record<SearchSection, boolean>>): Record<SearchSection, boolean> {
  return {
    buildings: false,
    stops: shown.buildings,
    stations: shown.buildings || shown.stops,
    spaces: shown.buildings || shown.stops || shown.stations,
  };
}

export function toCampusCounts(
  counts: SearchCounts,
  stops: readonly StopNameResult[],
  stations: readonly SubwayStation[],
): CampusCounts {
  const placesOn = (campus: Campus) => stops.filter((r) => r.campus === campus).length + stationsOnCampus(stations, campus).length;
  return {
    total: counts.building.total + counts.space.total + stops.length + stations.length,
    hssc: counts.building.hssc + counts.space.hssc + placesOn('hssc'),
    nsc: counts.building.nsc + counts.space.nsc + placesOn('nsc'),
  };
}

export function toDirectionLabel(
  directions: readonly StopDirection[],
  t: (key: TranslationKey) => string,
  tpl: (key: TranslationKey, ...args: (string | number)[]) => string,
): string {
  return directions.map((d) => (d.kind === 'towards' ? tpl('search.stopTowards', d.name) : t('search.stopTerminal'))).join(' · ');
}
