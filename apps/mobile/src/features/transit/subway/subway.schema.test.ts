/**
 * Subway arrivals: `GET /subway/stations/:stationId/arrivals`.
 *
 * All three fixtures are skkuverse-server's contract fixtures
 * (`contracts/produced/fixtures/subway-arrivals.subwayStationArrivals/`,
 * copied from server dev `8f3c67c2`, ADR 0022's call, where no train is a
 * first or last run), each `_about` saying how it was made:
 * `hyehwa.json` and `sungkyunkwan.json` are captures of 2026-10-17 trimmed to
 * one train per direction, one line each; `jeongja.json` is an untrimmed
 * capture of 2026-10-18, a station with two lines. They carry `data` only, so
 * `envelopeOf` adds the `meta` the live response has. `meta-server-now.json`
 * is the server's fixture of that meta (`subway-arrivals.subwayStationArrivalsMeta/serverNow.json`).
 */
import { describe, it, expect } from 'vitest';
import { parseOrThrow, type ApiEnvelope } from '@skkuverse/shared';
import { subwayArrivalsMetaSchema, subwayArrivalsSchema } from './subway.schema';
import hyehwa from './__fixtures__/hyehwa.json';
import jeongja from './__fixtures__/jeongja.json';
import sungkyunkwan from './__fixtures__/sungkyunkwan.json';
import metaServerNow from './__fixtures__/meta-server-now.json';

const parseSubwayArrivals = (envelope: ApiEnvelope<unknown>) => parseOrThrow(subwayArrivalsSchema, envelope.data, 'subway arrivals');

function envelopeOf(fixture: { data: unknown }): ApiEnvelope<unknown> {
  return { meta: { lang: 'ko' }, data: structuredClone(fixture.data) } as unknown as ApiEnvelope<unknown>;
}

type RawTrain = Record<string, unknown>;
type RawDirection = Record<string, unknown> & { trains: RawTrain[] };
type RawLine = Record<string, unknown> & { line: Record<string, unknown>; directions: RawDirection[] };
type RawData = Record<string, unknown> & { lines: RawLine[] };

/** `fixture`'s envelope with its data edited by `edit`. */
function editedEnvelope(fixture: { data: unknown }, edit: (data: RawData) => void): ApiEnvelope<unknown> {
  const envelope = envelopeOf(fixture);
  edit(envelope.data as RawData);
  return envelope;
}

/** The 성균관대 envelope with the directions of its one line edited by `edit`. */
function sungkyunkwanWith(edit: (directions: RawDirection[]) => void): ApiEnvelope<unknown> {
  return editedEnvelope(sungkyunkwan, (data) => edit(data.lines[0].directions));
}

describe('parseSubwayArrivals', () => {
  it('reads 성균관대: the station, its one line and both directions, up first', () => {
    const arrivals = parseSubwayArrivals(envelopeOf(sungkyunkwan));

    expect(arrivals.stationId).toBe('sungkyunkwan');
    expect(arrivals.stationName).toBe('성균관대');
    expect(arrivals.lines).toHaveLength(1);
    expect(arrivals.lines[0].directions.map((d) => [d.direction, d.name, d.nextStationName])).toEqual([
      ['up', '서울 방면', '의왕'],
      ['down', '천안·서동탄 방면', '화서'],
    ]);
  });

  it('reads a line as the server draws it: code, name, color and marker', () => {
    expect(parseSubwayArrivals(envelopeOf(sungkyunkwan)).lines[0].line).toEqual({
      code: '1',
      name: '1호선',
      color: '0052A4',
      marker: { text: '1', color: '0052A4' },
    });
  });

  it("keeps the line's own color apart from its marker's, which may be darker", () => {
    const { line } = parseSubwayArrivals(envelopeOf(hyehwa)).lines[0];

    expect([line.color, line.marker]).toEqual(['00A5DE', { text: '4', color: '007FAB' }]);
  });

  it('reads a train as the call: its number, headsign, express flag, arrival instant, basis, status and stops away', () => {
    const arrivals = parseSubwayArrivals(envelopeOf(sungkyunkwan));

    expect(arrivals.lines[0].directions[1].trains).toEqual([
      {
        trainNo: '1915',
        headsign: '천안',
        isExpress: true,
        arrivalAt: Date.parse('2026-10-17T02:38:38.000Z'),
        basis: 'estimate',
        status: 'arriving',
        stopsAway: 0,
        isFirstRun: false,
        isLastRun: false,
        onTrack: true,
      },
    ]);
  });

  it('reads 혜화 the same way', () => {
    const arrivals = parseSubwayArrivals(envelopeOf(hyehwa));

    expect(arrivals.stationName).toBe('혜화');
    expect(arrivals.lines[0].directions.map((d) => d.nextStationName)).toEqual(['한성대입구', '동대문']);
    expect(arrivals.lines[0].directions[0].trains[0].headsign).toBe('불암산');
  });

  it('reads every line of a station with several, in the server order', () => {
    const arrivals = parseSubwayArrivals(envelopeOf(jeongja));

    expect(arrivals.stationName).toBe('정자');
    expect(arrivals.lines.map((l) => [l.line.code, l.line.name, l.line.color, l.line.marker])).toEqual([
      ['D1', '신분당선', 'D4003B', { text: '신', color: 'D4003B' }],
      ['K1', '수인분당선', 'F5A200', { text: '수', color: 'A26B00' }],
    ]);
    expect(arrivals.lines.map((l) => l.directions.map((d) => d.nextStationName))).toEqual([
      ['판교', '미금'],
      ['수내', '미금'],
    ]);
    expect(arrivals.lines[1].directions.map((d) => d.trains.map((t) => t.trainNo))).toEqual([
      ['6136', '6138', '6544'],
      ['6117', '6549', '6119'],
    ]);
  });

  it('orders trains soonest first whatever order they arrive in', () => {
    const envelope = sungkyunkwanWith(([up]) => {
      const first = up.trains[0];
      up.trains = [
        { ...first, trainNo: '0450', expectedArrivalAt: '2026-10-17T11:52:00+09:00' },
        { ...first, trainNo: '0444', expectedArrivalAt: '2026-10-17T11:44:00+09:00' },
      ];
    });

    const [up] = parseSubwayArrivals(envelope).lines[0].directions;

    expect(up.trains.map((t) => t.trainNo)).toEqual(['0444', '0450']);
  });

  it('drops a train whose arrival time cannot be read and keeps the rest', () => {
    const envelope = sungkyunkwanWith(([up]) => {
      const first = up.trains[0];
      up.trains = [{ ...first, trainNo: '0001', expectedArrivalAt: 'soon' }, first];
    });

    const [up] = parseSubwayArrivals(envelope).lines[0].directions;

    expect(up.trains.map((t) => t.trainNo)).toEqual(['0444']);
  });

  it('drops a train with no number or no headsign, which the screen keys and shows', () => {
    const envelope = sungkyunkwanWith(([up]) => {
      const first = up.trains[0];
      up.trains = [{ ...first, trainNo: 444 }, { ...first, trainNo: '0445', headsign: null }, first];
    });

    const [up] = parseSubwayArrivals(envelope).lines[0].directions;

    expect(up.trains.map((t) => t.trainNo)).toEqual(['0444']);
  });

  it('reads an empty trains list as no trains, as the night service sends it', () => {
    const envelope = sungkyunkwanWith((directions) => {
      for (const d of directions) d.trains = [];
    });

    const arrivals = parseSubwayArrivals(envelope);

    expect(arrivals.lines[0].directions.map((d) => d.trains)).toEqual([[], []]);
  });

  it('reads stopsAway as a count of stations, or null when the train was not seen', () => {
    const arrivals = parseSubwayArrivals(envelopeOf(hyehwa));

    expect(arrivals.lines[0].directions.map((d) => d.trains[0].stopsAway)).toEqual([2, null]);
  });

  it('reads a stopsAway that is not a whole number as null', () => {
    const envelope = sungkyunkwanWith(([up]) => {
      up.trains[0].stopsAway = 'two';
    });

    expect(parseSubwayArrivals(envelope).lines[0].directions[0].trains[0].stopsAway).toBeNull();
  });

  it('reads a missing next station as null', () => {
    const envelope = sungkyunkwanWith(([up]) => {
      up.nextStation = null;
    });

    expect(parseSubwayArrivals(envelope).lines[0].directions[0].nextStationName).toBeNull();
  });

  it('drops a direction this build does not know, alone', () => {
    const envelope = sungkyunkwanWith(([up]) => {
      up.direction = 'sideways';
    });

    expect(parseSubwayArrivals(envelope).lines[0].directions.map((d) => d.direction)).toEqual(['down']);
  });

  it('drops a line whose display data is broken and keeps the other', () => {
    const envelope = editedEnvelope(jeongja, (data) => {
      delete data.lines[0].line.color;
    });

    expect(parseSubwayArrivals(envelope).lines.map((l) => l.line.code)).toEqual(['K1']);
  });

  it.each([
    ['no marker', (line: Record<string, unknown>) => delete line.marker],
    ['a marker that is not an object', (line: Record<string, unknown>) => (line.marker = '신')],
    ['an empty marker text', (line: Record<string, unknown>) => (line.marker = { text: '', color: 'D4003B' })],
    ['a marker color that is not six hex digits', (line: Record<string, unknown>) => (line.marker = { text: '신', color: '#D4003B' })],
    ['a line color that is not six hex digits', (line: Record<string, unknown>) => (line.color = 'red')],
  ])('drops a line with %s alone, since the marker is how the screen names it', (_, edit) => {
    const envelope = editedEnvelope(jeongja, (data) => {
      edit(data.lines[0].line);
    });

    expect(parseSubwayArrivals(envelope).lines.map((l) => l.line.code)).toEqual(['K1']);
  });

  it('drops a line left with no readable direction', () => {
    const envelope = editedEnvelope(jeongja, (data) => {
      data.lines[1].directions = [];
    });

    expect(parseSubwayArrivals(envelope).lines.map((l) => l.line.code)).toEqual(['D1']);
  });

  it('refuses a payload with no station name or no readable line, so the screen shows an error', () => {
    const noStation = editedEnvelope(hyehwa, (data) => {
      delete data.station;
    });
    const noLines = editedEnvelope(hyehwa, (data) => {
      delete data.lines[0].line.code;
    });

    expect(() => parseSubwayArrivals(noStation)).toThrow();
    expect(() => parseSubwayArrivals(noLines)).toThrow();
  });
});

describe('a station served with no line', () => {
  it('reads `lines: []`, as 성균관대 answers briefly while the server deploys, as a station with no trains', () => {
    // Arrange
    const envelope = editedEnvelope(sungkyunkwan, (data) => {
      data.lines = [];
    });

    // Act
    const arrivals = parseSubwayArrivals(envelope);

    // Assert
    expect(arrivals).toMatchObject({ stationId: 'sungkyunkwan', stationName: '성균관대', lines: [] });
  });

  it('still refuses served lines none of which reads, or no list at all', () => {
    // Arrange
    const unreadable = editedEnvelope(hyehwa, (data) => {
      delete data.lines[0].line.code;
    });
    const absent = editedEnvelope(hyehwa, (data) => {
      delete (data as Record<string, unknown>).lines;
    });

    // Act & Assert
    expect(() => parseSubwayArrivals(unreadable)).toThrow();
    expect(() => parseSubwayArrivals(absent)).toThrow();
  });
});

describe('a train is the call (ADR 0022)', () => {
  const upTrain = (envelope: ApiEnvelope<unknown>) => parseSubwayArrivals(envelope).lines[0].directions[0].trains[0];
  const withTrain = (edit: (train: RawTrain) => void) => sungkyunkwanWith(([up]) => edit(up.trains[0]));

  it('reads an instant at +09:00 and the same instant in Z alike', () => {
    // Arrange
    const kst = withTrain((t) => (t.expectedArrivalAt = '2026-10-17T11:44:37+09:00'));
    const utc = withTrain((t) => (t.expectedArrivalAt = '2026-10-17T02:44:37Z'));

    // Act & Assert
    expect(upTrain(kst).arrivalAt).toBe(Date.parse('2026-10-17T02:44:37.000Z'));
    expect(upTrain(utc).arrivalAt).toBe(upTrain(kst).arrivalAt);
  });

  it('counts a timetable train down to its scheduled arrival, or its scheduled departure at its origin', () => {
    // Arrange
    const scheduled = withTrain((t) => {
      Object.assign(t, { basis: 'timetable', status: 'scheduled', expectedArrivalAt: null, scheduledArrivalAt: '2026-10-17T11:50:00+09:00' });
    });
    const atOrigin = withTrain((t) => {
      Object.assign(t, { basis: 'timetable', expectedArrivalAt: null, scheduledArrivalAt: null, scheduledDepartureAt: '2026-10-17T11:51:00+09:00' });
    });

    // Act & Assert
    expect(upTrain(scheduled)).toMatchObject({ basis: 'timetable', status: 'scheduled', arrivalAt: Date.parse('2026-10-17T02:50:00Z') });
    expect(upTrain(atOrigin).arrivalAt).toBe(Date.parse('2026-10-17T02:51:00Z'));
  });

  it('counts an estimate down to its expected arrival, not the timetable time beside it', () => {
    // Arrange
    const envelope = withTrain((t) => {
      Object.assign(t, { expectedArrivalAt: '2026-10-17T11:46:00+09:00', scheduledArrivalAt: '2026-10-17T11:44:00+09:00' });
    });

    // Act & Assert
    expect(upTrain(envelope).arrivalAt).toBe(Date.parse('2026-10-17T02:46:00Z'));
  });

  it.each([
    [0, 'arriving', 0],
    [1, 'arriving', 1],
    [2, 'enRoute', 2],
  ])('reads stopsAway %p as served, in C4’s count', (stopsAway, status, read) => {
    // Arrange
    const envelope = withTrain((t) => Object.assign(t, { stopsAway, status }));

    // Act & Assert
    expect(upTrain(envelope).stopsAway).toBe(read);
  });

  it.each([
    ['a local train seen upstream', { isExpress: false, stopsAway: 2, status: 'enRoute' }, true],
    ['a local train standing here', { isExpress: false, stopsAway: 0, status: 'arriving' }, true],
    ['an express standing here', { isExpress: true, stopsAway: 0, status: 'arriving' }, true],
    ['an express nobody has seen, placed by its time', { isExpress: true, stopsAway: null, status: 'unknown' }, true],
    // WHY: the call's count skips the platforms an express passes, and the track ticks every station.
    // WHY: an express approaching here (1, arriving) has nothing left to pass, so its stretch is exact.
    ['an express approaching here', { isExpress: true, stopsAway: 1, status: 'arriving' }, true],
    ['an express at 1 that is not arriving', { isExpress: true, stopsAway: 1, status: 'unknown' }, false],
    ['an express seen upstream', { isExpress: true, stopsAway: 3, status: 'enRoute' }, false],
    ['a train that has left here (0, unknown)', { isExpress: false, stopsAway: 0, status: 'unknown' }, false],
  ])('puts %s on the track: %p', (_, fields, onTrack) => {
    // Arrange
    const envelope = withTrain((t) => Object.assign(t, fields));

    // Act
    const train = upTrain(envelope);

    // Assert: the row and its countdown stay either way.
    expect(train).toMatchObject({ trainNo: '0444', onTrack, arrivalAt: Date.parse('2026-10-17T02:44:37Z') });
  });

  it('reads a basis or a status this build does not know as unknown, and keeps the train and its time', () => {
    // Arrange
    const envelope = withTrain((t) => Object.assign(t, { basis: 'crowdsourced', status: 'boarding' }));

    // Act
    const train = upTrain(envelope);

    // Assert
    expect(train).toMatchObject({ trainNo: '0444', basis: 'unknown', status: 'unknown', arrivalAt: Date.parse('2026-10-17T02:44:37Z') });
  });

  it.each([
    ['true', true, true],
    ['null, for a train stored before the server knew', null, false],
    ['absent', undefined, false],
  ])('reads isLastRun %s', (_, isLastRun, read) => {
    // Arrange
    const envelope = withTrain((t) => {
      if (isLastRun === undefined) delete t.isLastRun;
      else t.isLastRun = isLastRun;
    });

    // Act & Assert
    expect(upTrain(envelope).isLastRun).toBe(read);
  });

  it('ignores a field this build does not know', () => {
    // Arrange
    const plain = upTrain(envelopeOf(sungkyunkwan));
    const envelope = withTrain((t) => (t.platformCar = { door: 4 }));

    // Act & Assert
    expect(upTrain(envelope)).toStrictEqual(plain);
  });
});

describe('a station\u2019s coordinates', () => {
  it('reads the station\u2019s coordinates, which the station sheet frames (ADR 0022)', () => {
    // Act
    const arrivals = parseSubwayArrivals(envelopeOf(hyehwa));

    // Assert
    expect(arrivals.coords).toStrictEqual({ lat: 37.582336, lng: 127.001844 });
  });

  it.each([
    ['null', (station: Record<string, unknown>) => (station.coords = null)],
    ['absent', (station: Record<string, unknown>) => delete station.coords],
    ['not a pair of finite numbers', (station: Record<string, unknown>) => (station.coords = { lat: '37.58', lng: null })],
  ])('reads coordinates that are %s as none, and the station still answers', (_, edit) => {
    // Arrange
    const envelope = editedEnvelope(hyehwa, (data) => {
      edit(data.station as Record<string, unknown>);
    });

    // Act
    const arrivals = parseSubwayArrivals(envelope);

    // Assert
    expect(arrivals.coords).toBeNull();
    expect(arrivals.stationName).toBe('혜화');
  });
});

describe('the first-train flag (ADR 0022 d4)', () => {
  const firstOf = (envelope: ApiEnvelope<unknown>) =>
    parseSubwayArrivals(envelope).lines[0].directions.map((d) => d.trains.map((t) => t.isFirstRun));

  it('reads every served train as not the first, as the fixtures serve it', () => {
    // Act & Assert
    expect(firstOf(envelopeOf(sungkyunkwan))).toEqual([[false], [false]]);
  });

  it('reads a train the server marks as the service day\u2019s first', () => {
    // Arrange
    const envelope = sungkyunkwanWith((directions) => {
      directions[0].trains[0].isFirstRun = true;
    });

    // Act & Assert
    expect(firstOf(envelope)).toEqual([[true], [false]]);
  });

  it.each([
    ['absent', (train: RawTrain) => delete train.isFirstRun],
    ['not a boolean', (train: RawTrain) => (train.isFirstRun = 'true')],
    ['null, for a train stored before the server knew', (train: RawTrain) => (train.isFirstRun = null)],
  ])('reads a flag that is %s as not the first, and keeps the train', (_, edit) => {
    // Arrange
    const envelope = sungkyunkwanWith((directions) => edit(directions[0].trains[0]));

    // Act & Assert
    expect(firstOf(envelope)).toEqual([[false], [false]]);
  });
});

describe('the arrivals meta: the server clock', () => {
  it('reads serverNow, the server fixture\u2019s instant at +09:00, as epoch ms', () => {
    // Act
    const meta = parseOrThrow(subwayArrivalsMetaSchema, { lang: 'ko', ...metaServerNow.data }, 'subway meta');

    // Assert
    expect(meta).toStrictEqual({ serverNowMs: Date.parse('2026-10-16T11:41:02.000Z') });
  });

  it.each([
    ['a meta without it', { lang: 'ko' }],
    ['an unreadable instant', { lang: 'ko', serverNow: 'soon' }],
    ['a meta that is not an object', null],
  ])('reads %s as no server clock', (_, meta) => {
    // Act & Assert
    expect(parseOrThrow(subwayArrivalsMetaSchema, meta, 'subway meta')).toStrictEqual({});
  });
});
