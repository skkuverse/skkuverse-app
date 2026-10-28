// WHY: headless; the map never imports transit to read `/bus/stops` or `/subway/stations`.

import { useMemo } from 'react';
import { useMapWorld } from '@/features/map/useMapWorld';
import { useMapPlaces } from '@/features/map/useMapPlaces';
import { toStationPlaces, toStopPlaces } from './map-lens.rules';
import { useSubwayStations } from './subway/useSubwayStations';
import { useBusStops } from './useBusStops';

export function TransitPlaceFeed() {
  const { mapConfig } = useMapWorld();
  const { data: stops } = useBusStops();
  const { data: stations } = useSubwayStations();
  const stationPlaces = useMemo(() => (stations ? toStationPlaces(stations) : null), [stations]);
  useMapPlaces('subway_station', stationPlaces);
  const places = useMemo(
    () => (stops && mapConfig ? toStopPlaces(stops, mapConfig.layers) : null),
    [stops, mapConfig],
  );
  useMapPlaces('bus_stop', places);
  return null;
}
