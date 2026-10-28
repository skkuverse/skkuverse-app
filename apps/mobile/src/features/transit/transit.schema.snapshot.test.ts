/**
 * Characterization: the transit schemas over every committed server fixture.
 * The snapshots were written by the hand parsers, and the zod schemas
 * reproduce every one.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow, type ApiEnvelope } from '@skkuverse/shared';
import { transitLayoutSchema } from './layout.schema';
import { liveGroupSchema } from './live.schema';
import { busStopsSchema, stopArrivalsSchema } from './stops.schema';
import { smartScheduleSchema } from './smart-schedule.schema';
import { busGroupSchema } from './bus-config.schema';
import { subwayArrivalsMetaSchema, subwayArrivalsSchema, subwayStationsSchema } from './subway/subway.schema';
import commuteKo from './__fixtures__/bus-config-commute-ko.json';
import commuteEn from './__fixtures__/bus-config-commute-en.json';
import commuteZh from './__fixtures__/bus-config-commute-zh.json';
import campusKo from './__fixtures__/bus-config-campus-ko.json';
import campusEn from './__fixtures__/bus-config-campus-en.json';
import campusZh from './__fixtures__/bus-config-campus-zh.json';
import campusV1 from './__fixtures__/bus-config-campus-v1-ko.json';
import realtimeHssc from './__fixtures__/bus-config-realtime-hssc.json';
import realtimeHsscAlightOnly from './__fixtures__/bus-config-realtime-hssc-alight-only.json';
import realtimeJongro07 from './__fixtures__/bus-config-realtime-jongro07.json';
import realtimeJongro07Directions from './__fixtures__/bus-config-realtime-jongro07-directions.json';
import gangnamYangjae from './__fixtures__/smart-commute-gangnam-yangjae-ko.json';
import liveHsscLayover from './__fixtures__/live-hssc-layover.json';
import liveHsscNoData from './__fixtures__/live-hssc-no-data.json';
import liveHsscRunning from './__fixtures__/live-hssc-running.json';
import liveJongro07 from './__fixtures__/live-jongro07.json';
import busStops from './__fixtures__/bus-stops-hssc-shuttle-and-poles.json';
import stopBusLot from './__fixtures__/stop-arrivals-hssc-bus-lot.json';
import stopOlympicHall from './__fixtures__/stop-arrivals-hssc-olympic-hall.json';
import stopHyehwaPole from './__fixtures__/stop-arrivals-seoul-01592.json';
import hyehwa from './subway/__fixtures__/hyehwa.json';
import jeongja from './subway/__fixtures__/jeongja.json';
import sungkyunkwan from './subway/__fixtures__/sungkyunkwan.json';
import subwayStations from './subway/__fixtures__/stations.json';
import subwayMetaServerNow from './subway/__fixtures__/meta-server-now.json';
import layoutKo from './__fixtures__/launch-ko.json';
import layoutEn from './__fixtures__/launch-en.json';
import layoutCampusTagged from './__fixtures__/campus-tagged-ko.json';

const envelope = (raw: unknown) => raw as ApiEnvelope<unknown>;
const parseBusGroup = (e: ApiEnvelope<unknown>) => parseOrThrow(busGroupSchema, e.data, 'bus config');
const parseSmartSchedule = (e: ApiEnvelope<unknown>) => parseOrThrow(smartScheduleSchema, e.data, 'smart schedule');
const parseSubwayArrivals = (e: ApiEnvelope<unknown>) => parseOrThrow(subwayArrivalsSchema, e.data, 'subway arrivals');
const parseTransitLayout = (data: unknown) => parseOrThrow(transitLayoutSchema, data, 'transit layout');

/** The live and stop-page fixtures carry `data` only, so the meta the live response has is added. */
const META = { lang: 'ko', serverNow: '2026-10-20T10:00:00+09:00' };

describe('bus config', () => {
  it.each([
    ['commute-ko', commuteKo],
    ['commute-en', commuteEn],
    ['commute-zh', commuteZh],
    ['campus-ko', campusKo],
    ['campus-en', campusEn],
    ['campus-zh', campusZh],
    ['campus-v1-ko', campusV1],
    ['realtime-hssc', realtimeHssc],
    ['realtime-hssc-alight-only', realtimeHsscAlightOnly],
    ['realtime-jongro07', realtimeJongro07],
    ['realtime-jongro07-directions', realtimeJongro07Directions],
  ])('%s', (_name, fixture) => {
    expect(parseBusGroup(envelope(fixture))).toMatchSnapshot();
  });
});

describe('smart schedule', () => {
  it('commute 강남·양재', () => {
    expect(parseSmartSchedule(envelope(gangnamYangjae))).toMatchSnapshot();
  });
});

describe('live group', () => {
  it.each([
    ['hssc-layover', liveHsscLayover],
    ['hssc-no-data', liveHsscNoData],
    ['hssc-running', liveHsscRunning],
    ['jongro07', liveJongro07],
  ])('%s', (_name, fixture) => {
    expect(parseOrThrow(liveGroupSchema, { meta: META, data: fixture.data }, 'live group')).toMatchSnapshot();
  });
});

describe('bus stops', () => {
  it('hssc shuttle and poles', () => {
    expect(parseOrThrow(busStopsSchema, busStops.data, 'bus stops')).toMatchSnapshot();
  });
});

describe('stop arrivals', () => {
  it.each([
    ['hssc-bus-lot', stopBusLot],
    ['hssc-olympic-hall', stopOlympicHall],
    ['seoul-01592', stopHyehwaPole],
  ])('%s', (_name, fixture) => {
    expect(parseOrThrow(stopArrivalsSchema, { meta: META, data: fixture.data }, 'stop arrivals')).toMatchSnapshot();
  });
});

describe('subway arrivals', () => {
  it.each([
    ['hyehwa', hyehwa],
    ['jeongja', jeongja],
    ['sungkyunkwan', sungkyunkwan],
  ])('%s', (_name, fixture) => {
    expect(parseSubwayArrivals(envelope(fixture))).toMatchSnapshot();
  });

  it('meta with the server clock', () => {
    expect(parseOrThrow(subwayArrivalsMetaSchema, { lang: 'ko', ...subwayMetaServerNow.data }, 'subway meta')).toMatchSnapshot();
  });
});

describe('subway stations', () => {
  it('all stations', () => {
    expect(parseOrThrow(subwayStationsSchema, subwayStations.data, 'subway stations')).toMatchSnapshot();
  });
});

describe('transit layout', () => {
  it.each([
    ['launch-ko', layoutKo],
    ['launch-en', layoutEn],
    ['campus-tagged-ko', layoutCampusTagged],
  ])('%s', (_name, fixture) => {
    expect(parseTransitLayout(fixture.data)).toMatchSnapshot();
  });
});
