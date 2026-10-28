/**
 * Schedule config v2: `serviceSelector`, `stops` (with their `map`),
 * `services[].stopSequences`, and `stopTimes` on the entries.
 *
 * `bus-config-{commute,campus}-{ko,en,zh}.json` are `GET /bus/config/:groupId`.
 * The commute ones are production's full envelope, captured on 2026-10-18
 * with each `Accept-Language`. The campus ones are captured from
 * skkuverse-server `fa2fd86` (design D14 of its
 * `add-inja-shuttle-schedule-v2` change) on 2026-10-09. The 강남·양재 smart
 * schedule is from server PR #204 on 2026-10-08. `bus-config-campus-v1-ko.json`
 * is the 인자셔틀 before it moved to v2, the guard that a v1 group still parses
 * to the v1 screen.
 */
import { describe, it, expect } from 'vitest';
import { parseOrThrow, type ApiEnvelope } from '@skkuverse/shared';
import { smartScheduleSchema } from './smart-schedule.schema';
import { busGroupSchema } from './bus-config.schema';
import type { ScheduleScreenConfig } from './transit.types';
import commute from './__fixtures__/bus-config-commute-ko.json';
import commuteEn from './__fixtures__/bus-config-commute-en.json';
import commuteZh from './__fixtures__/bus-config-commute-zh.json';
import campus from './__fixtures__/bus-config-campus-ko.json';
import campusEn from './__fixtures__/bus-config-campus-en.json';
import campusZh from './__fixtures__/bus-config-campus-zh.json';
import campusV1 from './__fixtures__/bus-config-campus-v1-ko.json';
import gangnamYangjae from './__fixtures__/smart-commute-gangnam-yangjae-ko.json';

const parseBusGroup = (envelope: ApiEnvelope<unknown>) => parseOrThrow(busGroupSchema, envelope.data, 'bus config');
const parseSmartSchedule = (envelope: ApiEnvelope<unknown>) => parseOrThrow(smartScheduleSchema, envelope.data, 'smart schedule');

function screenOf(envelope: unknown): ScheduleScreenConfig {
  const group = parseBusGroup(envelope as ApiEnvelope<unknown>);
  if (group.screenType !== 'schedule') throw new Error('expected a schedule group');
  return group.screen;
}

/** The commute envelope with its screen edited by `edit`. */
function commuteWith(edit: (screen: Record<string, unknown>) => void): unknown {
  const copy = structuredClone(commute) as { data: { screen: Record<string, unknown> } };
  edit(copy.data.screen);
  return copy;
}

type RawService = { serviceId: string; stopSequences: Record<string, Record<string, unknown>[]> };
const rawServices = (s: Record<string, unknown>) => s.services as RawService[];

describe('schedule config v2 parsing', () => {
  it('reads the commute group: chips, five routes, fourteen stops', () => {
    const screen = screenOf(commute);
    expect(screen.serviceSelector).toBe('chips');
    expect(screen.services.map((s) => s.serviceId)).toEqual([
      'commute-jeongja',
      'commute-jamsil',
      'commute-dogok',
      'commute-gangnam-yangjae',
      'commute-gwanggyo',
    ]);
    expect(screen.stops).toHaveLength(14);
    expect(screen.services.every((s) => s.stopSequences?.up && s.stopSequences?.down)).toBe(true);
  });

  it('reads the 강남·양재 sequences: two boarding stops up, two drop-offs down', () => {
    const service = screenOf(commute).services.find((s) => s.serviceId === 'commute-gangnam-yangjae');
    const up = service?.stopSequences?.up ?? [];
    expect(up.map((s) => [s.label, s.action, s.timing, s.stopId])).toEqual([
      ['강남역 5번 출구', 'board', 'scheduled', 'gangnam-exit5'],
      ['양재역 2번 출구', 'board', 'scheduled', 'yangjae-exit2'],
      ['N센터 앞', 'alight', 'estimated', 'nsc-n-center'],
    ]);
    expect(up[2].detail).toContain('N센터');
    expect(service?.stopSequences?.down.map((s) => [s.action, s.stopId])).toEqual([
      ['board', 'nsc-opposite'],
      ['alight', 'yangjae-exit3'],
      ['alight', 'gangnam-median'],
    ]);
  });

  it('reads a station stop map: its exit, and the walk from it to the stop', () => {
    const screen = screenOf(commute);
    const jeongja = screen.stops.find((s) => s.id === 'jeongja-exit3');
    const exit = jeongja?.map?.markers[0];
    expect(exit).toMatchObject({ id: 'exit3', kind: 'subwayExit', label: '3번 출구', number: 3 });
    const walk = jeongja?.map?.paths[0];
    expect([walk?.kind, walk?.from, walk?.to]).toEqual(['walk', 'exit3', 'stop']);
    expect(walk?.points[0]).toEqual(exit?.coords);
    expect(walk?.points.at(-1)).toEqual(jeongja?.coords);
    expect(jeongja?.photoUrl).toMatch(/^https:\/\/media\.skkuverse\.com\//);
  });

  it('reads a drop-off with an exit and no walk, and a pin-only stop', () => {
    const screen = screenOf(commute);
    const dropOff = screen.stops.find((s) => s.id === 'jeongja-exit2');
    expect(dropOff?.map?.markers.map((m) => m.number)).toEqual([2]);
    expect(dropOff?.map?.paths).toEqual([]);
    expect(dropOff).not.toHaveProperty('photoUrl');
    expect(screen.stops.find((s) => s.id === 'gangnam-median')?.map).toEqual({ markers: [], paths: [] });
    expect(screen.stops.find((s) => s.id === 'nsc-opposite')?.map).toEqual({ markers: [], paths: [] });
  });

  it('reads the exit labels in the request language', () => {
    const label = (envelope: unknown) =>
      screenOf(envelope).stops.find((s) => s.id === 'jeongja-exit3')?.map?.markers[0].label;
    expect([label(commute), label(commuteEn), label(commuteZh)]).toEqual(['3번 출구', 'Exit 3', '3号出口']);
  });

  it('reads the subway station each commute station stop is at, in the request language', () => {
    const screen = screenOf(commute);
    const station = (id: string) => screen.stops.find((s) => s.id === id)?.subwayStation;
    expect(station('jeongja-exit2')).toEqual({ id: 'jeongja', title: '정자역' });
    expect(station('yangjae-exit3')).toEqual({ id: 'yangjae', title: '양재역' });
    expect(station('gangnam-median')).toEqual({ id: 'gangnam', title: '강남역' });
    expect(station('gwanggyo-exit1')).toEqual({ id: 'gwanggyo-jungang', title: '광교중앙역' });
    expect(screen.stops.filter((s) => s.subwayStation)).toHaveLength(12);
    expect(screen.stops.find((s) => s.id === 'nsc-n-center')).not.toHaveProperty('subwayStation');
    expect(screen.stops.find((s) => s.id === 'nsc-opposite')).not.toHaveProperty('subwayStation');
    const title = (envelope: unknown) =>
      screenOf(envelope).stops.find((s) => s.id === 'jeongja-exit2')?.subwayStation?.title;
    expect([title(commute), title(commuteEn), title(commuteZh)]).toEqual(['정자역', 'Jeongja Station', '亭子站']);
  });

  it('drops a malformed subway station, never the stop', () => {
    const malformed: unknown[] = [
      { title: '정자역' },
      { id: '', title: '정자역' },
      { id: 'jeongja' },
      { id: 'jeongja', title: '' },
      { id: 7, title: '정자역' },
      'jeongja',
      null,
    ];
    for (const value of malformed) {
      const screen = screenOf(
        commuteWith((s) => {
          (s.stops as Record<string, unknown>[]).find((st) => st.id === 'jeongja-exit2')!.subwayStation = value;
        }),
      );
      const stop = screen.stops.find((s) => s.id === 'jeongja-exit2');
      expect(stop?.name).toBe('정자역 2번 출구 앞');
      expect(stop).not.toHaveProperty('subwayStation');
    }
  });

  it('reads the 인자셔틀 on v2: segmented, regular and 학부대학, pin-only stops', () => {
    for (const envelope of [campus, campusEn, campusZh]) {
      const screen = screenOf(envelope);
      expect(screen.serviceSelector).toBe('segmented');
      expect(screen.services.map((s) => Object.keys(s.stopSequences ?? {}))).toEqual([
        ['regular', 'hakbu'],
        ['regular', 'hakbu'],
      ]);
      expect(screen.stops).toHaveLength(6);
      expect(screen.stops.every((s) => s.coords && s.map?.markers.length === 0 && s.map.paths.length === 0)).toBe(
        true,
      );
    }
    const inja = screenOf(campus).services[0].stopSequences;
    expect(inja?.regular.map((s) => [s.action, s.stopId])).toEqual([
      ['board', 'hssc-bus-lot'],
      ['alight', 'nsc-n-center'],
      ['alight', 'nsc-welfare'],
    ]);
    expect(inja?.hakbu.at(-1)?.stopId).toBe('nsc-cns');
  });

  it('parses a v1 group to the v1 screen', () => {
    const screen = screenOf(campusV1);
    expect(screen.serviceSelector).toBe('segmented');
    expect(screen.stops).toEqual([]);
    expect(screen.services.every((s) => !('stopSequences' in s))).toBe(true);
  });

  it('reads an unknown selector as segmented', () => {
    const screen = screenOf(commuteWith((s) => (s.serviceSelector = 'carousel')));
    expect(screen.serviceSelector).toBe('segmented');
  });

  it('drops a whole sequence with an unreadable stop, never part of one', () => {
    const screen = screenOf(
      commuteWith((s) => {
        rawServices(s)[0].stopSequences.up[0].action = 'teleport';
      }),
    );
    expect(screen.services[0].stopSequences?.up).toBeUndefined();
    expect(screen.services[0].stopSequences?.down).toHaveLength(2);
  });

  it('reads an unknown timing as estimated', () => {
    const screen = screenOf(
      commuteWith((s) => {
        rawServices(s)[0].stopSequences.up[0].timing = 'live';
      }),
    );
    expect(screen.services[0].stopSequences?.up[0].timing).toBe('estimated');
  });

  it('drops a stop id the catalog does not have, and the stops nobody names', () => {
    const screen = screenOf(
      commuteWith((s) => {
        s.stops = (s.stops as { id: string }[]).filter((stop) => stop.id !== 'jeongja-exit3');
        (s.stops as unknown[]).push({ id: 'orphan', name: '아무도 안 씀' });
      }),
    );
    const up = screen.services.find((s) => s.serviceId === 'commute-jeongja')?.stopSequences?.up;
    expect(up?.[0].label).toBe('정자역 3번 출구');
    expect(up?.[0]).not.toHaveProperty('stopId');
    expect(screen.stops.some((stop) => stop.id === 'orphan')).toBe(false);
  });

  it('drops markers and paths of an unknown kind or with bad fields, one at a time', () => {
    const screen = screenOf(
      commuteWith((s) => {
        const stop = (s.stops as Record<string, unknown>[]).find((st) => st.id === 'jeongja-exit3')!;
        const map = stop.map as { markers: Record<string, unknown>[]; paths: Record<string, unknown>[] };
        const exit = map.markers[0];
        const walk = map.paths[0];
        map.markers.push(
          { ...exit, id: 'bldg', kind: 'place' },
          { ...exit, id: 'exit9', number: '9' },
          { ...exit, id: 'exit8', label: '' },
          { ...exit, id: 'exit7', coords: { lat: 'x', lng: 127 } },
        );
        map.paths.push(
          { ...walk, kind: 'drive' },
          { ...walk, points: [(walk.points as unknown[])[0]] },
          { ...walk, points: [...(walk.points as unknown[]), null] },
          { ...walk, from: '' },
        );
      }),
    );
    const map = screen.stops.find((s) => s.id === 'jeongja-exit3')?.map;
    expect(map?.markers.map((m) => m.id)).toEqual(['exit3']);
    expect(map?.paths).toHaveLength(1);
  });

  it('keeps a walk whose end marker was dropped', () => {
    const screen = screenOf(
      commuteWith((s) => {
        const stop = (s.stops as Record<string, unknown>[]).find((st) => st.id === 'jamsil-exit4')!;
        (stop.map as { markers: Record<string, unknown>[] }).markers[0].kind = 'subwayEntrance';
      }),
    );
    const map = screen.stops.find((s) => s.id === 'jamsil-exit4')?.map;
    expect(map?.markers).toEqual([]);
    expect(map?.paths.map((p) => [p.from, p.to])).toEqual([['exit4', 'stop']]);
  });

  it('drops the map of a stop without coords, and reads no map as none', () => {
    const screen = screenOf(
      commuteWith((s) => {
        const stops = s.stops as Record<string, unknown>[];
        delete stops.find((st) => st.id === 'jeongja-exit3')!.coords;
        delete stops.find((st) => st.id === 'jamsil-exit4')!.map;
        stops.find((st) => st.id === 'dogok-exit1')!.map = [];
      }),
    );
    for (const id of ['jeongja-exit3', 'jamsil-exit4', 'dogok-exit1']) {
      expect(screen.stops.find((s) => s.id === id)).not.toHaveProperty('map');
    }
  });

  it('reads a map missing an array as empty there', () => {
    const screen = screenOf(
      commuteWith((s) => {
        const stop = (s.stops as Record<string, unknown>[]).find((st) => st.id === 'jeongja-exit3')!;
        delete (stop.map as Record<string, unknown>).paths;
      }),
    );
    const map = screen.stops.find((s) => s.id === 'jeongja-exit3')?.map;
    expect(map?.markers).toHaveLength(1);
    expect(map?.paths).toEqual([]);
  });

  it('ignores the retired exit and walkPath fields', () => {
    const screen = screenOf(
      commuteWith((s) => {
        const stop = (s.stops as Record<string, unknown>[]).find((st) => st.id === 'nsc-opposite')!;
        stop.exit = { number: 1, coords: { lat: 37.29, lng: 126.97 } };
        stop.walkPath = [{ lat: 37.29, lng: 126.97 }, stop.coords];
      }),
    );
    const stop = screen.stops.find((s) => s.id === 'nsc-opposite');
    expect(stop).not.toHaveProperty('exit');
    expect(stop).not.toHaveProperty('walkPath');
    expect(stop?.map).toEqual({ markers: [], paths: [] });
  });

  it('drops links that are not https', () => {
    const screen = screenOf(
      commuteWith((s) => {
        const stop = (s.stops as Record<string, unknown>[])[0];
        stop.photoUrl = 'http://media.skkuverse.com/a.jpg';
        stop.streetViewUrl = 'javascript:alert(1)';
      }),
    );
    expect(screen.stops[0]).not.toHaveProperty('photoUrl');
    expect(screen.stops[0]).not.toHaveProperty('streetViewUrl');
  });
});

describe('stopTimes parsing', () => {
  const days = parseSmartSchedule(gangnamYangjae as unknown as ApiEnvelope<unknown>).days;
  const entries = days.find((d) => d.display === 'schedule')?.schedule ?? [];

  it('reads a time per stop, null where unknown', () => {
    expect(entries[0].stopTimes).toEqual(['07:40', '07:45', '08:45']);
    const down = entries.find((e) => e.routeType === 'down');
    expect(down?.stopTimes?.[1]).toBeNull();
  });

  it('drops stopTimes holding anything but HH:MM or null', () => {
    const copy = structuredClone(gangnamYangjae) as { data: { days: { schedule: Record<string, unknown>[] }[] } };
    copy.data.days[0].schedule[0].stopTimes = ['07:40', '7:45', '08:45'];
    const parsed = parseSmartSchedule(copy as ApiEnvelope<unknown>);
    expect(parsed.days[0].schedule[0]).not.toHaveProperty('stopTimes');
  });
});

describe('eta and notice style parsing', () => {
  type RawSmart = {
    data: { days: { notices: Record<string, unknown>[]; schedule: Record<string, unknown>[] }[] };
  };
  /** The 강남·양재 schedule with its first day edited by `edit`, parsed. */
  const firstDayWith = (edit: (day: RawSmart['data']['days'][number]) => void) => {
    const copy = structuredClone(gangnamYangjae) as RawSmart;
    edit(copy.data.days[0]);
    return parseSmartSchedule(copy as unknown as ApiEnvelope<unknown>).days[0];
  };
  const withEta = (eta: unknown) =>
    firstDayWith((day) => {
      day.schedule[0].eta = eta;
    }).schedule[0];

  it('leaves a commute run, whose estimated stops are timetable times, without eta', () => {
    const days = parseSmartSchedule(gangnamYangjae as unknown as ApiEnvelope<unknown>).days;
    expect(days.flatMap((d) => d.schedule).some((e) => 'eta' in e)).toBe(false);
  });

  it('keeps a known source', () => {
    const updatedAt = '2026-10-09T12:24:09.774Z';
    expect(withEta({ source: 'predicted', updatedAt }).eta).toEqual({ source: 'predicted', updatedAt });
    expect(withEta({ source: 'live', updatedAt }).eta?.source).toBe('live');
    expect(withEta({ source: 'frozen', updatedAt }).eta?.source).toBe('frozen');
  });

  it('reads a source it does not know as unknown, still an estimate', () => {
    expect(withEta({ source: 'satellite', updatedAt: '2026-10-09T12:24:09.774Z' }).eta?.source).toBe(
      'unknown',
    );
  });

  it('drops an eta that is not an object or has no updatedAt', () => {
    expect(withEta('predicted')).not.toHaveProperty('eta');
    expect(withEta(null)).not.toHaveProperty('eta');
    expect(withEta({ source: 'live' })).not.toHaveProperty('eta');
  });

  it('keeps the warning and ai styles and reads anything else as info', () => {
    const day = firstDayWith((d) => {
      d.notices = ['ai', 'warning', 'error', 'banner', undefined].map((style) => ({
        style,
        text: 't',
        source: 'service',
      }));
    });
    expect(day.notices.map((n) => n.style)).toEqual(['ai', 'warning', 'info', 'info', 'info']);
  });
});

describe('crowding parsing', () => {
  type RawSmart = { data: { days: { schedule: Record<string, unknown>[] }[] } };
  const withCrowding = (crowding: unknown) => {
    const copy = structuredClone(gangnamYangjae) as RawSmart;
    copy.data.days[0].schedule[0].crowding = crowding;
    return parseSmartSchedule(copy as unknown as ApiEnvelope<unknown>).days[0].schedule[0].crowding;
  };

  it('reads every run as unknown while the server sends no crowding', () => {
    const days = parseSmartSchedule(gangnamYangjae as unknown as ApiEnvelope<unknown>).days;
    const entries = days.flatMap((d) => d.schedule);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.crowding === 'unknown')).toBe(true);
  });

  it('keeps a known level', () => {
    expect(withCrowding('unknown')).toBe('unknown');
    expect(withCrowding('spacious')).toBe('spacious');
    expect(withCrowding('crowded')).toBe('crowded');
    expect(withCrowding('full')).toBe('full');
  });

  it('reads a missing, null or unknown level as unknown', () => {
    expect(withCrowding(undefined)).toBe('unknown');
    expect(withCrowding(null)).toBe('unknown');
    expect(withCrowding('standing')).toBe('unknown');
    expect(withCrowding(2)).toBe('unknown');
    expect(withCrowding({ level: 'full' })).toBe('unknown');
  });
});

describe('service refresh parsing', () => {
  /** The first commute service's `refresh` after its raw one is set to `refresh`. */
  const refreshOf = (refresh: unknown) =>
    screenOf(
      commuteWith((s) => {
        (rawServices(s)[0] as Record<string, unknown>).refresh = refresh;
      }),
    ).services[0].refresh;

  /** What production sends on every commute service. */
  const served = { targets: ['traffic'], intervalSec: 60 };

  it('reads the refresh the server sends, and has none when it is missing or malformed', () => {
    expect(screenOf(commute).services.map((s) => s.refresh)).toEqual([served, served, served, served, served]);
    expect(refreshOf(undefined)).toBeUndefined();
    expect(refreshOf(null)).toBeUndefined();
    expect(refreshOf('traffic')).toBeUndefined();
  });

  it('reads its targets and interval', () => {
    expect(refreshOf({ targets: ['traffic'], intervalSec: 60 })).toEqual({
      targets: ['traffic'],
      intervalSec: 60,
    });
    expect(refreshOf({ targets: ['crowding', 'traffic'], intervalSec: 90 })?.targets).toEqual(
      expect.arrayContaining(['traffic', 'crowding']),
    );
  });

  it('drops a target it does not know, and is absent when none is left', () => {
    expect(refreshOf({ targets: ['traffic', 'weather'], intervalSec: 60 })?.targets).toEqual([
      'traffic',
    ]);
    expect(refreshOf({ targets: ['weather'], intervalSec: 60 })).toBeUndefined();
    expect(refreshOf({ targets: [], intervalSec: 60 })).toBeUndefined();
    expect(refreshOf({ targets: 'traffic', intervalSec: 60 })).toBeUndefined();
    expect(refreshOf({ intervalSec: 60 })).toBeUndefined();
  });

  it('defaults a missing or unusable interval to 60 seconds', () => {
    expect(refreshOf({ targets: ['traffic'] })?.intervalSec).toBe(60);
    expect(refreshOf({ targets: ['traffic'], intervalSec: '30' })?.intervalSec).toBe(60);
    expect(refreshOf({ targets: ['traffic'], intervalSec: 0 })?.intervalSec).toBe(60);
    expect(refreshOf({ targets: ['traffic'], intervalSec: -5 })?.intervalSec).toBe(60);
    expect(refreshOf({ targets: ['traffic'], intervalSec: Number.NaN })?.intervalSec).toBe(60);
  });

  it('raises an interval too short to 15 seconds', () => {
    expect(refreshOf({ targets: ['traffic'], intervalSec: 1 })?.intervalSec).toBe(15);
    expect(refreshOf({ targets: ['traffic'], intervalSec: 15 })?.intervalSec).toBe(15);
    expect(refreshOf({ targets: ['traffic'], intervalSec: 30 })?.intervalSec).toBe(30);
  });

  it('leaves the other services alone', () => {
    const screen = screenOf(
      commuteWith((s) => {
        (rawServices(s)[0] as Record<string, unknown>).refresh = { targets: ['crowding'], intervalSec: 90 };
      }),
    );
    expect(screen.services[0].refresh).toEqual({ targets: ['crowding'], intervalSec: 90 });
    expect(screen.services.slice(1).map((s) => s.refresh)).toEqual([served, served, served, served]);
  });
});
