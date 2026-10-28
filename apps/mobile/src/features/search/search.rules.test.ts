/**
 * Stops in search (ADR 0022 d4): one result per stop name, each pole a sub-row
 * told apart by its direction, matched on the names the server serves.
 * The stops are trimmed copies of production `GET /bus/stops` entries. The
 * stations are `GET /subway/stations` entries, one result each.
 */

import { describe, it, expect } from 'vitest';
import { t, tpl, type AppLanguage, type TranslationKey } from '@skkuverse/shared';
import type { BusStop, BusStopRoute } from '@/features/transit/transit.types';
import type { SubwayLine, SubwayStation } from '@/features/transit/subway/subway.types';
import {
  dividedSections,
  searchStations,
  searchStops,
  stationsOnCampus,
  toCampusCounts,
  toDirectionLabel,
  type StopNameResult,
} from './search.rules';

const HSSC_SHUTTLE = { ko: '인사캠 셔틀버스', en: 'HSSC Shuttle Bus', zh: '人文校区班车' };
const JONGNO_07 = { ko: '종로 07', en: 'Jongro 07', zh: '钟路 07' };
const JONGNO_08 = { ko: '종로 08', en: 'Jongro 08', zh: '钟路 08' };

/** A Jongno name: Korean in every language, as the server serves it. */
const korean = (ko: string) => ({ ko, en: ko, zh: ko });

function live(label: BusStopRoute['label'], towards: BusStopRoute['label'] | null, groupId = 'hssc'): BusStopRoute {
  return { kind: 'live', groupId, label, stationIndex: 0, towards, action: 'board' };
}

function stop(id: string, name: BusStop['name'], routes: BusStopRoute[], campus: BusStop['campus'] = 'hssc'): BusStop {
  return { id, name, coords: { lat: 37.58, lng: 126.99 }, campus, routes };
}

const MAIN_GATE_OUT = stop('hssc-main-gate-out', { ko: '정문', en: 'Main Gate of SKKU', zh: 'Main Gate of SKKU' }, [
  live(HSSC_SHUTTLE, { ko: '올림픽기념국민생활관', en: 'Olympic Hall', zh: 'Olympic Hall' }),
]);
const MAIN_GATE_IN = stop('hssc-main-gate-in', { ko: '정문', en: 'Main Gate of SKKU', zh: 'Main Gate of SKKU' }, [
  live(HSSC_SHUTTLE, { ko: '600주년기념관', en: '600th Anniversary Hall', zh: '600th Anniversary Hall' }),
]);
const STUDENT_CENTER = stop('hssc-student-center', { ko: '학생회관', en: 'Student Center', zh: 'Student Center' }, [
  live(HSSC_SHUTTLE, { ko: '정문', en: 'Main Gate of SKKU', zh: 'Main Gate of SKKU' }),
]);
const STUDENT_CENTER_POLE = stop('seoul-01618', korean('학생회관'), [
  live(JONGNO_07, korean('비천당'), 'jongro07'),
]);
const HYEHWA_EXIT1 = stop('hssc-hyehwa-exit1', { ko: '혜화역 1번출구', en: 'Hyehwa Station (Shuttle Bus Stop)', zh: 'Hyehwa Station (Shuttle Bus Stop)' }, [
  live(HSSC_SHUTTLE, { ko: '성균관대입구사거리', en: 'SKKU Junction', zh: 'SKKU Junction' }),
]);
const HYEHWA_EXIT1_POLE = stop('seoul-01592', korean('혜화역1번출구'), [
  live(JONGNO_07, korean('혜화동로터리'), 'jongro07'),
  live(JONGNO_08, korean('혜화동로터리'), 'jongro08'),
]);
const ANGUK_A = stop('seoul-01548', korean('안국선원.삼거리'), [live({ ...korean('종로 02') }, korean('북촌한옥마을입구.정세권활동터'), 'jongro02')]);
const HALL_600_TERMINAL = stop('seoul-01616', korean('600주년기념관'), [live(JONGNO_07, null, 'jongro07')]);
const HALL_600_SHUTTLE = stop('hssc-600th-hall', { ko: '600주년기념관', en: '600th Anniversary Hall', zh: '600th Anniversary Hall' }, [
  live(HSSC_SHUTTLE, { ko: '농구장', en: 'Basketball Court (Shuttle Bus Stop)', zh: 'Basketball Court (Shuttle Bus Stop)' }),
]);
/** A campus shuttle drop-off: timetable routes only. */
const N_CENTER = stop(
  'nsc-n-center',
  { ko: 'N센터 앞', en: 'N Center', zh: 'N Center' },
  [
    { kind: 'timetable', groupId: 'campus', label: { ko: '인사캠 → 자과캠', en: 'HSSC → NSC', zh: 'HSSC → NSC' }, serviceId: 'campus-inja', routeType: 'regular', action: 'alight' },
  ],
  'nsc',
);

const ALL = [
  MAIN_GATE_OUT,
  STUDENT_CENTER,
  MAIN_GATE_IN,
  STUDENT_CENTER_POLE,
  HYEHWA_EXIT1,
  HYEHWA_EXIT1_POLE,
  ANGUK_A,
  HALL_600_SHUTTLE,
  HALL_600_TERMINAL,
  N_CENTER,
];

describe('searchStops', () => {
  it('finds nothing for an empty or blank query', () => {
    expect(searchStops(ALL, '', 'ko')).toEqual([]);
    expect(searchStops(ALL, '   ', 'ko')).toEqual([]);
  });

  it('shows one result per name, with each pole as a sub-row labeled by its direction', () => {
    const results = searchStops(ALL, '정문', 'ko');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: '정문', campus: 'hssc' });
    expect(results[0].poles).toEqual([
      { stopId: 'hssc-main-gate-out', directions: [{ kind: 'towards', name: '올림픽기념국민생활관' }], routeLabels: ['인사캠 셔틀버스'] },
      { stopId: 'hssc-main-gate-in', directions: [{ kind: 'towards', name: '600주년기념관' }], routeLabels: ['인사캠 셔틀버스'] },
    ]);
  });

  it('puts poles from different lines under one name together', () => {
    const [result] = searchStops(ALL, '학생회관', 'ko');

    expect(result.poles.map((p) => p.stopId)).toEqual(['hssc-student-center', 'seoul-01618']);
    expect(result.poles[1]).toEqual({
      stopId: 'seoul-01618',
      directions: [{ kind: 'towards', name: '비천당' }],
      routeLabels: ['종로 07'],
    });
  });

  it('treats names that differ only in spacing or punctuation as one name, shown as the first pole spells it', () => {
    const results = searchStops(ALL, '혜화역 1번', 'ko');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('혜화역 1번출구');
    expect(results[0].poles.map((p) => p.stopId)).toEqual(['hssc-hyehwa-exit1', 'seoul-01592']);
  });

  it('matches whatever spacing or punctuation the query uses', () => {
    expect(searchStops(ALL, '혜화역1', 'ko')).toHaveLength(1);
    expect(searchStops(ALL, '안국선원 삼거리', 'ko').map((r) => r.name)).toEqual(['안국선원.삼거리']);
  });

  it('lists the lines a pole serves once each, and a direction they share once', () => {
    const [result] = searchStops(ALL, '혜화역1번출구', 'ko');
    const pole = result.poles.find((p) => p.stopId === 'seoul-01592');

    expect(pole).toEqual({
      stopId: 'seoul-01592',
      directions: [{ kind: 'towards', name: '혜화동로터리' }],
      routeLabels: ['종로 07', '종로 08'],
    });
  });

  it("labels a pole at a line's last station as the terminal", () => {
    const [result] = searchStops(ALL, '600주년', 'ko');

    expect(result.poles.find((p) => p.stopId === 'seoul-01616')?.directions).toEqual([{ kind: 'terminal' }]);
  });

  it('matches English case-insensitively and shows the name in the app language', () => {
    const results = searchStops(ALL, 'main gate', 'en');

    expect(results.map((r) => r.name)).toEqual(['Main Gate of SKKU']);
    expect(results[0].poles[0].directions).toEqual([{ kind: 'towards', name: 'Olympic Hall' }]);
  });

  it('shows a Jongno pole by its served Korean name in English, never a made-up translation', () => {
    const results = searchStops(ALL, '학생회관', 'en');

    expect(results.map((r) => r.name)).toEqual(['Student Center', '학생회관']);
    expect(results[1].poles[0]).toEqual({
      stopId: 'seoul-01618',
      directions: [{ kind: 'towards', name: '비천당' }],
      routeLabels: ['Jongro 07'],
    });
  });

  it('keeps one name on two campuses as two results', () => {
    const nscGate = stop('nsc-main-gate', { ko: '정문', en: 'Main Gate', zh: 'Main Gate' }, [live(HSSC_SHUTTLE, korean('N센터'))], 'nsc');

    const results = searchStops([MAIN_GATE_OUT, nscGate], '정문', 'ko');

    expect(results.map((r) => [r.campus, r.poles.map((p) => p.stopId)])).toEqual([
      ['hssc', ['hssc-main-gate-out']],
      ['nsc', ['nsc-main-gate']],
    ]);
  });

  it('leaves out a stop served only by timetable shuttles, whose map entry ADR 0022 d6 defers', () => {
    expect(searchStops(ALL, 'N센터', 'ko')).toEqual([]);
  });

  it('lists a name that starts with the query before one that only contains it, else in the served order', () => {
    const skkuGate = stop('seoul-01722', korean('성균관대정문'), [live(JONGNO_07, korean('유림회관앞'), 'jongro07')]);

    expect(searchStops([skkuGate, MAIN_GATE_OUT], '정문', 'ko').map((r) => r.name)).toEqual(['정문', '성균관대정문']);
    expect(searchStops([HALL_600_SHUTTLE, STUDENT_CENTER], '관', 'ko').map((r) => r.name)).toEqual([
      '600주년기념관',
      '학생회관',
    ]);
  });
});

describe('searchStations', () => {
  const line = (code: string, name: string, text: string): SubwayLine => ({ code, name, color: '00A5DE', marker: { text, color: '007FAB' } });
  const station = (
    id: string,
    title: string,
    lines: SubwayLine[] = [line('4', '4호선', '4')],
    campus: SubwayStation['campus'] = null,
  ): SubwayStation => ({
    id,
    title,
    campus,
    lines,
    coords: { lat: 37.58, lng: 127.0 },
  });
  const HYEHWA = station('hyehwa', '혜화역');
  const SKKU = station('sungkyunkwan', '성균관대역', [line('1', '1호선', '1')]);
  const GWANGGYO = station('gwanggyo-jungang', '광교중앙역', [line('D1', '신분당선', '신')]);
  const STATIONS = [SKKU, HYEHWA, GWANGGYO];

  it('finds nothing for an empty or blank query', () => {
    // Act & Assert
    expect(searchStations(STATIONS, '')).toEqual([]);
    expect(searchStations(STATIONS, '  ')).toEqual([]);
  });

  it('finds a station by part of its title, one result per station', () => {
    // Act & Assert
    expect(searchStations(STATIONS, '혜화')).toEqual([HYEHWA]);
  });

  it('matches the title as served, whatever case, spacing or punctuation the query uses', () => {
    // Arrange: the English list, as the server answers Accept-Language en.
    const english = station('sungkyunkwan', 'Sungkyunkwan Univ. Station');

    // Act & Assert
    expect(searchStations([english], 'sungkyunkwan univ')).toEqual([english]);
    expect(searchStations([HYEHWA], '혜 화역')).toEqual([HYEHWA]);
  });

  it('lists a title that starts with the query before one that only contains it, else in the served order', () => {
    // Arrange
    const jungang = station('jungang', '중앙역');

    // Act & Assert
    expect(searchStations([GWANGGYO, jungang], '중앙').map((s) => s.id)).toEqual(['jungang', 'gwanggyo-jungang']);
    expect(searchStations(STATIONS, '역').map((s) => s.id)).toEqual(['sungkyunkwan', 'hyehwa', 'gwanggyo-jungang']);
  });
});

describe('stationsOnCampus', () => {
  const station = (id: string, campus: SubwayStation['campus']): SubwayStation => ({
    id,
    title: id,
    campus,
    lines: [],
    coords: null,
  });
  const HYEHWA = station('hyehwa', 'hssc');
  const JEONGJA = station('jeongja', 'nsc');
  const UNTAGGED = station('untagged', null);
  const ALL = [HYEHWA, JEONGJA, UNTAGGED];

  it('keeps every station under the all filter', () => {
    // Act & Assert
    expect(stationsOnCampus(ALL, undefined)).toEqual(ALL);
  });

  it('keeps the stations of one campus, and one with no campus, which belongs to both', () => {
    // Act & Assert
    expect(stationsOnCampus(ALL, 'hssc')).toEqual([HYEHWA, UNTAGGED]);
    expect(stationsOnCampus(ALL, 'nsc')).toEqual([JEONGJA, UNTAGGED]);
  });
});

describe('toCampusCounts', () => {
  const counts = { building: { hssc: 1, nsc: 2, total: 3 }, space: { hssc: 4, nsc: 0, total: 4 } };
  const name = (key: string, campus: StopNameResult['campus']): StopNameResult => ({ key, name: key, campus, poles: [] });
  const station = (id: string, campus: SubwayStation['campus']): SubwayStation => ({
    id,
    title: id,
    campus,
    lines: [],
    coords: null,
  });

  it('adds the buildings, spaces, stops and stations of each campus to its tab', () => {
    // Arrange
    const stops = [name('hssc-gate', 'hssc'), name('nsc-gate', 'nsc')];
    const stations = [station('hyehwa', 'hssc'), station('jeongja', 'nsc')];

    // Act & Assert
    expect(toCampusCounts(counts, stops, stations)).toEqual({ total: 11, hssc: 7, nsc: 4 });
  });

  it('counts a station with no campus on both tabs, and a stop with no campus in the total only', () => {
    // Arrange
    const stops = [name('jongno', null)];
    const stations = [station('untagged', null)];

    // Act & Assert
    expect(toCampusCounts(counts, stops, stations)).toEqual({ total: 9, hssc: 6, nsc: 3 });
  });
});

describe('toDirectionLabel', () => {
  const inLanguage = (lang: AppLanguage) =>
    [(key: TranslationKey) => t(lang, key), (key: TranslationKey, ...args: (string | number)[]) => tpl(lang, key, ...args)] as const;

  it("names each direction a pole serves, and a line's last station as the terminal", () => {
    // Act & Assert
    expect(toDirectionLabel([{ kind: 'towards', name: '혜화동로터리' }, { kind: 'terminal' }], ...inLanguage('ko'))).toBe(
      '혜화동로터리 방면 · 종점',
    );
    expect(toDirectionLabel([{ kind: 'towards', name: 'Olympic Hall' }], ...inLanguage('en'))).toBe('Toward Olympic Hall');
  });
});

describe('dividedSections', () => {
  const none = { buildings: false, stops: false, stations: false, spaces: false };

  it('draws no divider above the first section shown, whichever it is', () => {
    // Act & Assert
    expect(dividedSections({ ...none, spaces: true }).spaces).toBe(false);
    expect(dividedSections({ ...none, stations: true, spaces: true }).stations).toBe(false);
    expect(dividedSections({ ...none, buildings: true }).buildings).toBe(false);
  });

  it('divides every later section from the one shown above it', () => {
    // Act & Assert
    const stopsAndSpaces = dividedSections({ ...none, stops: true, spaces: true });
    expect([stopsAndSpaces.stops, stopsAndSpaces.spaces]).toEqual([false, true]);
    expect(dividedSections({ buildings: true, stops: true, stations: true, spaces: true })).toEqual({
      buildings: false,
      stops: true,
      stations: true,
      spaces: true,
    });
  });
});
