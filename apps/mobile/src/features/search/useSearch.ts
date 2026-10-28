import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  getLocalizedText,
  useSettingsStore,
} from '@skkuverse/shared';
import { openPlaceFromAbove, tabBeneath } from '@/features/map/map.service';
import { useMapNavigation } from '@/features/map/useMapNavigation';
import { useBusStops } from '@/features/transit/useBusStops';
import { logSearchContentSelect, logSearchFilterChange, logSearchPerform, logSearchResultTap } from '@/platform/analytics';
import { useSearchBuildings } from '@/features/map/building/useSearchBuildings';
import type { Building, SpaceGroup, SearchSpaceItem, MapNavPayload } from '@/features/map/building/building.types';
import { useSubwayStations } from '@/features/transit/subway/useSubwayStations';
import type { SubwayStation } from '@/features/transit/subway/subway.types';
import {
  searchStations,
  searchStops,
  stationsOnCampus,
  toCampusCounts,
  type SearchSection,
  type StopNameResult,
  type StopPoleResult,
} from './search.rules';

export type CampusFilter = 'all' | 'hssc' | 'nsc';

type FlatSpaceItem = SearchSpaceItem & { group: SpaceGroup };

const DEBOUNCE_MS = 500;

const NO_STOPS: StopNameResult[] = [];
const NO_STATIONS: SubwayStation[] = [];
const ALL_EXPANDED: Record<SearchSection, boolean> = { buildings: true, stops: true, stations: true, spaces: true };

// WHY: `listsStops` and `opensBeneath` are decided where the screen is composed; a shell without a stop or station sheet lists and fetches neither.
export function useSearch({ listsStops, opensBeneath }: { listsStops: boolean; opensBeneath: boolean }) {
  const router = useRouter();
  const lang = useSettingsStore((s) => s.appLanguage);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [expanded, setExpanded] = useState(ALL_EXPANDED);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPendingNavPayload = useMapNavigation();

  const [campusFilter, setCampusFilter] = useState<CampusFilter>('all');
  const campus = campusFilter === 'all' ? undefined : campusFilter;
  const { data } = useSearchBuildings(debouncedQuery, campus);
  // WHY: unfiltered, for the per-campus tab badges; under 'all' it shares the query key, so no extra request.
  const { data: countData } = useSearchBuildings(debouncedQuery, undefined);
  const lastLoggedQuery = useRef<string>('');

  const { data: stops } = useBusStops({ enabled: listsStops });
  const allStopResults = useMemo(
    () => (listsStops && stops ? searchStops(stops, debouncedQuery, lang) : NO_STOPS),
    [listsStops, stops, debouncedQuery, lang],
  );
  const stopResults = useMemo(
    () => (campus ? allStopResults.filter((r) => r.campus === campus) : allStopResults),
    [allStopResults, campus],
  );
  const { data: stations } = useSubwayStations({ enabled: listsStops });
  const allStationResults = useMemo(
    () => (listsStops && stations ? searchStations(stations, debouncedQuery) : NO_STATIONS),
    [listsStops, stations, debouncedQuery],
  );
  const stationResults = useMemo(() => stationsOnCampus(allStationResults, campus), [allStationResults, campus]);
  const campusCounts = useMemo(
    () => (countData && debouncedQuery ? toCampusCounts(countData.counts, allStopResults, allStationResults) : null),
    [countData, debouncedQuery, allStopResults, allStationResults],
  );

  // WHY: adjusted during render, not in an effect, so new results never paint once under the old collapse state.
  const resultsKey = `${campusFilter}\n${debouncedQuery}`;
  const [expansionKey, setExpansionKey] = useState(resultsKey);
  if (expansionKey !== resultsKey) {
    setExpansionKey(resultsKey);
    setExpanded(ALL_EXPANDED);
  }

  useEffect(() => {
    if (!debouncedQuery || !data || debouncedQuery === lastLoggedQuery.current) return;
    // WHY: waits for the stop list too, so its count is never a list still loading.
    if (listsStops && !stops) return;
    lastLoggedQuery.current = debouncedQuery;
    logSearchPerform({
      query: debouncedQuery,
      buildingResults: data.buildings.length,
      spaceResults: data.spaces.reduce((sum, g) => sum + g.items.length, 0),
      ...(listsStops && { stopResults: stopResults.length }),
      // WHY: a station list still loading, or failed, sends no count rather than a zero.
      ...(listsStops && stations && { stationResults: stationResults.length }),
      campusFilter: campusFilter,
    });
  }, [debouncedQuery, data, campusFilter, listsStops, stops, stopResults, stations, stationResults]);

  const cancelPendingQuery = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => cancelPendingQuery, [cancelPendingQuery]);

  const handleTextChange = useCallback((text: string) => {
    setInputValue(text);
    cancelPendingQuery();
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, DEBOUNCE_MS);
  }, [cancelPendingQuery]);

  const handleClear = useCallback(() => {
    logSearchContentSelect({ content_type: 'clear_button', item_id: 'x' });
    cancelPendingQuery();
    setInputValue('');
    setDebouncedQuery('');
  }, [cancelPendingQuery]);

  const handleCampusFilterChange = useCallback((filter: CampusFilter) => {
    logSearchFilterChange(filter);
    setCampusFilter(filter);
  }, []);

  const handleSectionToggle = useCallback(
    (section: SearchSection) => {
      logSearchContentSelect({ content_type: `section_${section}_toggle`, item_id: expanded[section] ? 'collapse' : 'expand' });
      setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    },
    [expanded],
  );

  const handleBuildingTap = useCallback(
    (building: Building) => {
      logSearchResultTap({
        resultType: 'building',
        resultName: getLocalizedText(building.name, lang),
        campus: building.campus,
        skkuId: building.skkuId,
      });
      const payload: MapNavPayload = {
        kind: 'building',
        skkuId: building.skkuId,
        tab: opensBeneath ? tabBeneath('skku_building') : 'map',
      };
      setPendingNavPayload(payload);
      router.back();
    },
    [setPendingNavPayload, router, lang, opensBeneath],
  );

  const handleSpaceTap = useCallback(
    (group: SpaceGroup, spaceCd: string, floor: string) => {
      if (group.skkuId == null) return;
      logSearchResultTap({
        resultType: 'space',
        resultName: getLocalizedText(group.buildingName, lang),
        campus: group.campus,
        skkuId: group.skkuId,
      });
      const payload: MapNavPayload = {
        kind: 'building',
        skkuId: group.skkuId,
        highlightSpaceCd: spaceCd,
        highlightFloor: floor,
        tab: opensBeneath ? tabBeneath('skku_building') : 'map',
      };
      setPendingNavPayload(payload);
      router.back();
    },
    [setPendingNavPayload, router, lang, opensBeneath],
  );

  const handleStopTap = useCallback((result: StopNameResult, pole: StopPoleResult) => {
    logSearchResultTap({
      resultType: 'bus_stop',
      resultName: result.name,
      campus: result.campus,
      stopId: pole.stopId,
    });
    openPlaceFromAbove({ kind: 'bus_stop', placeId: pole.stopId }, 'search');
  }, []);

  const handleStationTap = useCallback((station: SubwayStation) => {
    logSearchResultTap({
      resultType: 'subway_station',
      resultName: station.title,
      campus: station.campus,
      stationId: station.id,
    });
    openPlaceFromAbove({ kind: 'subway_station', placeId: station.id }, 'search');
  }, []);

  const flatSpaces = useMemo<FlatSpaceItem[]>(() => {
    if (!data) return [];
    return data.spaces.flatMap((group) =>
      group.items.map((item) => ({ ...item, group })),
    );
  }, [data]);

  return {
    inputValue,
    debouncedQuery,
    expanded,
    campusFilter,
    campusCounts,
    data,
    stopResults,
    stationResults,
    lang,
    handleTextChange,
    handleClear,
    handleCampusFilterChange,
    handleSectionToggle,
    handleBuildingTap,
    handleStopTap,
    handleStationTap,
    handleSpaceTap,
    flatSpaces,
  };
}
