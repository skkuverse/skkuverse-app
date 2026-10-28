import { describe, expect, it } from 'vitest';
import { toSubwayLinks } from './subway-links.rules';
import type { BoardingStop, SequenceStop } from '../transit.types';

const station = (id: string, title: string) => ({ id, title });

/** The commute catalog's stops, as GET /bus/config/commute serves them. */
const CATALOG = new Map<string, BoardingStop>(
  [
    { id: 'jeongja-exit3', name: '정자역 3번 출구', subwayStation: station('jeongja', '정자역') },
    { id: 'jeongja-exit2', name: '정자역 2번 출구 앞', subwayStation: station('jeongja', '정자역') },
    { id: 'gangnam-exit5', name: '강남역 5번 출구', subwayStation: station('gangnam', '강남역') },
    { id: 'yangjae-exit2', name: '양재역 2번 출구', subwayStation: station('yangjae', '양재역') },
    { id: 'yangjae-exit3', name: '양재역 3번 출구 앞', subwayStation: station('yangjae', '양재역') },
    { id: 'gangnam-median', name: '강남역 사거리 전 중앙버스차로 정류장', subwayStation: station('gangnam', '강남역') },
    { id: 'nsc-n-center', name: 'N센터 앞' },
    { id: 'nsc-opposite', name: 'N센터 맞은편' },
  ].map((stop) => [stop.id, stop]),
);

const board = (stopId: string): SequenceStop => ({ label: stopId, action: 'board', timing: 'scheduled', stopId });
const alight = (stopId?: string): SequenceStop => ({
  label: stopId ?? '자과캠',
  action: 'alight',
  timing: 'estimated',
  ...(stopId && { stopId }),
});

describe('toSubwayLinks', () => {
  it('links the station a route gets off at, never one it boards at', () => {
    // 정자: 등교 boards at 정자역, 하교 gets off there.
    const routes = [
      [board('jeongja-exit3'), alight('nsc-n-center')],
      [board('nsc-opposite'), alight('jeongja-exit2')],
    ];

    expect(toSubwayLinks(routes, CATALOG)).toEqual([{ stationId: 'jeongja', title: '정자역' }]);
  });

  it('keeps route order and lists a station once', () => {
    // 강남·양재: 하교 gets off at 양재, then 강남; a second route at 양재 adds nothing.
    const routes = [
      [board('gangnam-exit5'), board('yangjae-exit2'), alight('nsc-n-center')],
      [board('nsc-opposite'), alight('yangjae-exit3'), alight('gangnam-median')],
      [board('nsc-opposite'), alight('yangjae-exit3')],
    ];

    expect(toSubwayLinks(routes, CATALOG)).toEqual([
      { stationId: 'yangjae', title: '양재역' },
      { stationId: 'gangnam', title: '강남역' },
    ]);
  });

  it('is empty when no drop-off names a station', () => {
    const routes = [[board('jeongja-exit3'), alight('nsc-n-center'), alight(), alight('unknown-stop')]];

    expect(toSubwayLinks(routes, CATALOG)).toEqual([]);
    expect(toSubwayLinks([], CATALOG)).toEqual([]);
  });
});
