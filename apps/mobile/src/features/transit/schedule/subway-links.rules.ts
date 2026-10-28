import type { BoardingStop, SequenceStop } from '../transit.types';

export interface SubwayLink {
  stationId: string;
  title: string;
}

/** WHY: only a drop-off links to its station; at a boarding stop the photo and the exit already say where to stand. */
export function toSubwayLinks(
  sequences: readonly (readonly SequenceStop[])[],
  catalog: ReadonlyMap<string, BoardingStop>,
): SubwayLink[] {
  const links = new Map<string, SubwayLink>();
  for (const sequence of sequences) {
    for (const seqStop of sequence) {
      if (seqStop.action !== 'alight' || !seqStop.stopId) continue;
      const station = catalog.get(seqStop.stopId)?.subwayStation;
      if (station && !links.has(station.id)) links.set(station.id, { stationId: station.id, title: station.title });
    }
  }
  return [...links.values()];
}
