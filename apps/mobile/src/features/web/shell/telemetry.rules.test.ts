import { expect, test } from 'vitest';
import { bridgeMethodOf, MiniAppSession } from './telemetry.rules';

test('app.ready settles the load once; later outcomes are ignored', () => {
  const s = new MiniAppSession('eskara', 1000);
  expect(s.load('load_end', 1400)).toBe(null);
  expect(s.load('ready', 1600)).toStrictEqual({ miniapp_id: 'eskara', outcome: 'ready', ms: 600, status: undefined });
  expect(s.load('error', 1700)).toBe(null);
  expect(s.close(2000).load).toBe(null);
});

test('a page that never calls app.ready reports load_end at the time it loaded', () => {
  const s = new MiniAppSession('eskara', 1000);
  s.load('load_end', 1300);
  s.load('load_end', 1900); // WHY: a second document in the same open
  expect(s.close(5000).load).toStrictEqual({ miniapp_id: 'eskara', outcome: 'load_end', ms: 300 });
});

test('closing before the document loaded is abandoned', () => {
  const s = new MiniAppSession('eskara', 1000);
  expect(s.close(3500).load).toStrictEqual({ miniapp_id: 'eskara', outcome: 'abandoned', ms: 2500 });
});

test('an http error carries its status', () => {
  const s = new MiniAppSession('eskara', 0);
  expect(s.load('http_error', 50, 503)).toStrictEqual({ miniapp_id: 'eskara', outcome: 'http_error', ms: 50, status: 503 });
});

test('the bridge tally counts handled calls per method and every other outcome as rejected', () => {
  const s = new MiniAppSession('eskara', 0);
  s.bridge('haptic.impact', 'handled');
  s.bridge('haptic.impact', 'handled');
  s.bridge('map.openPlace', 'handled');
  s.bridge('link.open', 'dropped');
  s.bridge(null, 'dropped');
  s.bridge('x.y', 'unsupported');
  expect(s.close(0).bridge).toStrictEqual({
    miniapp_id: 'eskara',
    calls: 6,
    rejected: 3,
    m_haptic_impact: 2,
    m_map_openPlace: 1,
  });
});

test('no bridge event when the page never called it', () => {
  expect(new MiniAppSession('eskara', 0).close(0).bridge).toBe(null);
});

test('bridgeMethodOf reads the method of a message that parses, and null otherwise', () => {
  expect(bridgeMethodOf(JSON.stringify({ method: 'app.ready', params: {} }))).toBe('app.ready');
  expect(bridgeMethodOf('not json')).toBe(null);
});
