import type { MapDetent } from '@/features/map/sheet-detents.constants';
import type {
  BusStop,
  LineStation,
  LiveVehicle,
  RealtimeScreenConfig,
  RealtimeStation,
  VehiclePosition,
} from '../transit.types';

/**
 * QUIRK(skkuverse-server): a pole a line lists twice (the terminal of line 02) is served at its first index only, so
 * the entry at the station's own index is preferred and the line's first entry stands in.
 */
export function toLineStations(
  groupId: string,
  stations: readonly RealtimeStation[],
  stops: readonly BusStop[],
): LineStation[] {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  return stations.map((station) => {
    const stop = station.stopId ? byId.get(station.stopId) : undefined;
    const entries = stop?.routes.filter((r) => r.kind === 'live' && r.groupId === groupId) ?? [];
    const entry = entries.find((r) => r.kind === 'live' && r.stationIndex === station.index) ?? entries[0];
    return {
      station,
      stopId: station.stopId ?? null,
      name: stop?.name ?? null,
      coords: stop?.coords ?? null,
      campus: stop?.campus ?? null,
      towards: entry?.kind === 'live' ? entry.towards : null,
    };
  });
}

export interface LineSection {
  id: string;
  label: string;
  firstRow: number;
}

/** CONTRACT(skkuverse-server): skkuverse-server/docs/reference/bus-live-api.md serves directions as contiguous index ranges in order. */
export function toLineSections(screen: Pick<RealtimeScreenConfig, 'directions' | 'stations'>): LineSection[] {
  const sections: LineSection[] = [];
  for (const { id, label, fromIndex, toIndex } of screen.directions) {
    const firstRow = screen.stations.findIndex((s) => s.index >= fromIndex && s.index <= toIndex);
    if (firstRow >= 0) sections.push({ id, label, firstRow });
  }
  return sections;
}

export type PlacedVehicle = LiveVehicle & { position: VehiclePosition };

export function isPlaced(vehicle: LiveVehicle): vehicle is PlacedVehicle {
  return vehicle.position !== null;
}

/** WHY: a screen reader opens every sheet at the top, so under one nothing counts as the user expanding it. */
export function isLineExpand(detent: MapDetent, screenReader: boolean): boolean {
  return detent === 'page' && !screenReader;
}
