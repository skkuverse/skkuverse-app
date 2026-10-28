import { describe, expect, it } from 'vitest';
import {
  attachmentsFor,
  isNewAttachmentView,
  MAX_PER_ANCHOR,
  placeAttachments,
  toAttachmentInstanceId,
  toLineAttachments,
  toRunKey,
  TRANSFER_PRIORITY,
  type PlacedAttachments,
  type RunAttachment,
} from './run-attachments.rules';
import { runStops, type RunStop } from './schedule-config.rules';
import type { BoardingStop, BusService, ScheduleEntry } from '../transit.types';

const DAY = '2026-10-19';
const SERVICE = 'commute-gangnam-yangjae';
/** An instant on the test day, in KST. */
const at = (hhmm: string, date = DAY) => Date.parse(`${date}T${hhmm}:00+09:00`);

const station = (id: string, title: string) => ({ id, title });

/** The commute catalog's stops these runs pass, as the server serves them. */
const CATALOG: BoardingStop[] = [
  { id: 'gangnam-exit5', name: '강남역 5번 출구', subwayStation: station('gangnam', '강남역') },
  { id: 'yangjae-exit2', name: '양재역 2번 출구', subwayStation: station('yangjae', '양재역') },
  { id: 'nsc-n-center', name: 'N센터 앞' },
  { id: 'nsc-opposite', name: 'N센터 맞은편' },
  { id: 'yangjae-exit3', name: '양재역 3번 출구 앞', subwayStation: station('yangjae', '양재역') },
  { id: 'gangnam-median', name: '강남역 사거리 전 중앙버스차로 정류장', subwayStation: station('gangnam', '강남역') },
];

/** The 강남·양재 route: two boarding stops up, two drop-offs down (양재, then 강남). */
const SEQUENCES: BusService['stopSequences'] = {
  up: [
    { label: '강남역 5번 출구', action: 'board', timing: 'scheduled', stopId: 'gangnam-exit5' },
    { label: '양재역 2번 출구', action: 'board', timing: 'scheduled', stopId: 'yangjae-exit2' },
    { label: 'N센터 앞', action: 'alight', timing: 'estimated', stopId: 'nsc-n-center' },
  ],
  down: [
    { label: 'N센터 맞은편', action: 'board', timing: 'scheduled', stopId: 'nsc-opposite' },
    { label: '양재역 3번 출구 앞', action: 'alight', timing: 'estimated', stopId: 'yangjae-exit3' },
    { label: '강남역 사거리', action: 'alight', timing: 'estimated', stopId: 'gangnam-median' },
  ],
};

const run = (routeType: string, stopTimes: (string | null)[] | undefined, time = stopTimes?.[0]): ScheduleEntry => ({
  index: 1,
  time: time ?? '17:00',
  routeType,
  busCount: 1,
  ...(stopTimes && { stopTimes }),
  crowding: 'unknown',
});

/** 17:00 from N센터, 양재 at 17:45, 강남 at 17:51 (the timetable's estimates). */
const EVENING = run('down', ['17:00', '17:45', '17:51']);
const MORNING = run('up', ['07:40', '07:45', '08:29']);

/** The stop ids that carry a link at `hhmm`, anchor by anchor. */
function linkedAt(hhmm: string, entry = EVENING, date = DAY, sequences = SEQUENCES): string[] {
  const placed = attachmentsFor(entry, runStops(entry, sequences), at(hhmm), { catalog: CATALOG, serviceId: SERVICE, date });
  return placed.map(({ anchor, items }) =>
    [anchor.level === 'stop' ? anchor.stopId : 'run', ...items.map((item) => item.id)].join(' '),
  );
}

const YANGJAE = 'yangjae-exit3 transfer:yangjae';
const GANGNAM = 'gangnam-median transfer:gangnam';

describe('attachmentsFor: the subway transfer link', () => {
  it('shows nothing before a drop-off window opens', () => {
    expect(linkedAt('17:00')).toEqual([]);
    expect(linkedAt('17:24')).toEqual([]);
  });

  it('opens 20 minutes before the drop-off and closes 10 minutes after, both minutes included', () => {
    expect(linkedAt('17:25')).toEqual([YANGJAE]);
    expect(linkedAt('17:55')).toEqual([YANGJAE, GANGNAM]);
    expect(linkedAt('17:56')).toEqual([GANGNAM]);
  });

  it('shows nothing once every window has closed', () => {
    expect(linkedAt('18:01')).toEqual([GANGNAM]);
    expect(linkedAt('18:02')).toEqual([]);
    expect(linkedAt('23:00')).toEqual([]);
  });

  it('gives each drop-off of a run its own window', () => {
    expect(linkedAt('17:30')).toEqual([YANGJAE]);
    expect(linkedAt('17:31')).toEqual([YANGJAE, GANGNAM]);
    expect(linkedAt('17:58')).toEqual([GANGNAM]);
  });

  it('carries the station as served, for the label and the link', () => {
    const placed = attachmentsFor(EVENING, runStops(EVENING, SEQUENCES), at('17:45'), {
      catalog: CATALOG,
      serviceId: SERVICE,
      date: DAY,
    });
    expect(placed[0].items[0]).toEqual({
      id: 'transfer:yangjae',
      instanceId: 'transfer:yangjae@commute-gangnam-yangjae|down|2026-10-19|17:00',
      kind: 'transfer',
      anchor: { level: 'stop', stopId: 'yangjae-exit3' },
      window: { from: 'stopTime', startMin: -20, endMin: 10 },
      priority: 50,
      payload: { stationId: 'yangjae', title: '양재역' },
    });
    expect(TRANSFER_PRIORITY).toBe(50);
  });

  it('links no drop-off without a subway station, and no boarding stop', () => {
    // 08:29 is the morning run's N센터 drop-off; 07:45 its 양재 boarding stop.
    expect(linkedAt('08:29', MORNING)).toEqual([]);
    expect(linkedAt('07:45', MORNING)).toEqual([]);
    const unnamed = { ...SEQUENCES, down: SEQUENCES!.down.map(({ stopId: _, ...stop }) => stop) };
    expect(linkedAt('17:45', EVENING, DAY, unnamed)).toEqual([]);
  });

  it('shows nothing on another day', () => {
    expect(linkedAt('17:45', EVENING, '2026-10-20')).toEqual([]);
    expect(linkedAt('17:45', EVENING, '2026-10-18')).toEqual([]);
  });

  it('reads a stop time earlier than the departure as the next day, in KST', () => {
    const late = run('down', ['23:50', '00:20', '00:26']);
    const placedAt = (instant: number) =>
      attachmentsFor(late, runStops(late, SEQUENCES), instant, { catalog: CATALOG, serviceId: SERVICE, date: DAY }).map(
        ({ items }) => items[0].id,
      );
    expect(placedAt(at('00:10', '2026-10-20'))).toEqual(['transfer:yangjae', 'transfer:gangnam']);
    // The same clock time on the day the run is listed under is a day early.
    expect(placedAt(at('00:10', DAY))).toEqual([]);
  });

  it('uses the served stop time, an estimate included, and never moves the departure', () => {
    // 양재 estimated at 18:05 instead of 17:45: the window follows the estimate.
    const delayed = run('down', ['17:00', '18:05', '18:11']);
    expect(linkedAt('17:30', delayed)).toEqual([]);
    expect(linkedAt('17:45', delayed)).toEqual([YANGJAE]);
  });

  it('skips a drop-off whose time is unknown, and a run without stop times', () => {
    expect(linkedAt('17:45', run('down', ['17:00', null, '17:51']))).toEqual([GANGNAM]);
    expect(linkedAt('17:45', run('down', undefined))).toEqual([]);
  });
});

describe('placeAttachments', () => {
  const stops = runStops(EVENING, SEQUENCES);
  const attachment = (id: string, priority: number, overrides: Partial<RunAttachment> = {}): RunAttachment => ({
    id,
    kind: 'transfer',
    anchor: { level: 'stop', stopId: 'yangjae-exit3' },
    window: { from: 'stopTime', startMin: -20, endMin: 10 },
    priority,
    payload: { stationId: id, title: id },
    ...overrides,
  });
  const RUN = { serviceId: SERVICE, date: DAY };
  const place = (candidates: RunAttachment[], hhmm = '17:45') =>
    placeAttachments(candidates, EVENING, stops, at(hhmm), RUN).map(({ anchor, items }) => [
      anchor.level === 'stop' ? anchor.stopId : 'run',
      items.map((item) => item.id),
    ]);

  it('puts two at the same anchor in one group, higher priority first, ties in their given order', () => {
    expect(place([attachment('a', 1), attachment('b', 2)])).toEqual([['yangjae-exit3', ['b', 'a']]]);
    expect(place([attachment('x', 5), attachment('y', 5)])).toEqual([['yangjae-exit3', ['x', 'y']]]);
  });

  it(`keeps at most ${MAX_PER_ANCHOR} per anchor, the highest priorities`, () => {
    expect(place([attachment('a', 1), attachment('c', 3), attachment('b', 2)])).toEqual([
      ['yangjae-exit3', ['c', 'b']],
    ]);
  });

  it('keeps one instance per id and run, the higher priority', () => {
    const placed = placeAttachments(
      [attachment('a', 1, { payload: { stationId: 'low', title: 'low' } }), attachment('a', 2)],
      EVENING,
      stops,
      at('17:45'),
      RUN,
    );
    expect(placed[0].items).toHaveLength(1);
    expect(placed[0].items[0].payload.stationId).toBe('a');
    expect(placed[0].items[0].instanceId).toBe('a@commute-gangnam-yangjae|down|2026-10-19|17:00');
  });

  it('orders the run first, then the stops in the order the bus reaches them', () => {
    const run: RunAttachment = attachment('r', 1, {
      anchor: { level: 'run' },
      window: { from: 'departure', startMin: 0, endMin: 60 },
    });
    const gangnam = attachment('g', 1, { anchor: { level: 'stop', stopId: 'gangnam-median' } });
    expect(place([gangnam, attachment('y', 1), run])).toEqual([
      ['run', ['r']],
      ['yangjae-exit3', ['y']],
      ['gangnam-median', ['g']],
    ]);
  });

  it('reads a departure window from the run, and drops one anchored at a stop the run does not pass', () => {
    const departure = attachment('d', 1, {
      anchor: { level: 'run' },
      window: { from: 'departure', startMin: -10, endMin: 0 },
    });
    expect(place([departure], '16:50')).toEqual([['run', ['d']]]);
    expect(place([departure], '17:01')).toEqual([]);
    expect(place([attachment('x', 1, { anchor: { level: 'stop', stopId: 'jamsil-exit5' } })])).toEqual([]);
  });

  it('shows nothing for a stop-time window anchored on the run', () => {
    expect(place([attachment('r', 1, { anchor: { level: 'run' } })])).toEqual([]);
  });
});

describe('toLineAttachments: the line of the drawn run each box hangs under', () => {
  const stops: RunStop[] = runStops(EVENING, SEQUENCES) ?? [];
  const box = (anchor: PlacedAttachments['anchor']): PlacedAttachments => ({ anchor, items: [] });
  const RUN_BOX = box({ level: 'run' });
  const YANGJAE_BOX = box({ level: 'stop', stopId: 'yangjae-exit3' });
  const GANGNAM_BOX = box({ level: 'stop', stopId: 'gangnam-median' });

  it("hangs a stop's box under that stop's line and the run's under the last line, in the given order", () => {
    expect(toLineAttachments([RUN_BOX, YANGJAE_BOX, GANGNAM_BOX], stops)).toEqual([
      [],
      [YANGJAE_BOX],
      [RUN_BOX, GANGNAM_BOX],
    ]);
  });

  it('hangs a box at a stop the run passes twice under the first pass only', () => {
    expect(toLineAttachments([YANGJAE_BOX], [...stops, stops[1]])).toEqual([[], [YANGJAE_BOX], [], []]);
  });

  it('drops a box at a stop the run does not pass', () => {
    expect(toLineAttachments([box({ level: 'stop', stopId: 'jamsil-exit5' })], stops)).toEqual([[], [], []]);
  });

  it("draws a run without stop times as one line, which takes the run's box and no stop's", () => {
    expect(toLineAttachments([RUN_BOX, YANGJAE_BOX], null)).toEqual([[RUN_BOX]]);
  });
});

describe('run keys and instance ids', () => {
  it("names a run as the server's ETA does: service, route type, listed day, scheduled departure", () => {
    expect(toRunKey(SERVICE, DAY, EVENING)).toBe('commute-gangnam-yangjae|down|2026-10-19|17:00');
  });

  it('tells apart the Friday 인자셔틀 runs that leave at the same time on two routes', () => {
    const friday = '2026-10-23';
    const regular = run('regular', ['08:00', null]);
    const hakbu = run('hakbu', ['08:00', null]);
    expect(toRunKey('campus-inja', friday, regular)).toBe('campus-inja|regular|2026-10-23|08:00');
    expect(toRunKey('campus-inja', friday, regular)).not.toBe(toRunKey('campus-inja', friday, hakbu));
  });

  it('sends a view once per attachment instance', () => {
    const seen = new Set<string>();
    const key = toAttachmentInstanceId('transfer:jeongja', 'commute-jeongja|down|2026-10-19|17:00');
    expect(key).toBe('transfer:jeongja@commute-jeongja|down|2026-10-19|17:00');
    expect(isNewAttachmentView(seen, key)).toBe(true);
    expect(isNewAttachmentView(seen, key)).toBe(false);
    expect(
      isNewAttachmentView(seen, toAttachmentInstanceId('transfer:jeongja', 'commute-jeongja|down|2026-10-19|18:00')),
    ).toBe(true);
  });
});
