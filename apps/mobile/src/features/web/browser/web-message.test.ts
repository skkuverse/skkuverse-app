import { expect, test } from 'vitest';
import { parseWebMessage } from '../../../../../../packages/bridge/src/receiver';

// `web:action` is the first message whose payload the receiver checks: its
// fields go straight to an allowlist that expects strings, so a message one
// field short must be refused here rather than reach it.

test('parses a well-formed web:action', () => {
  const msg = parseWebMessage(
    JSON.stringify({ type: 'web:action', actionType: 'map', actionValue: 'event:x' }),
  );
  expect(msg).toStrictEqual({ type: 'web:action', actionType: 'map', actionValue: 'event:x' });
});

for (const [label, payload] of [
  ['a missing actionValue', { type: 'web:action', actionType: 'map' }],
  ['a non-string actionValue', { type: 'web:action', actionType: 'map', actionValue: 31 }],
  ['an empty actionType', { type: 'web:action', actionType: '', actionValue: 'event:x' }],
  ['an object actionType', { type: 'web:action', actionType: {}, actionValue: 'event:x' }],
] as const) {
  test(`refuses a web:action with ${label}`, () => {
    expect(parseWebMessage(JSON.stringify(payload))).toBe(null);
  });
}

// `web:open-url` reaches `Linking.openURL`, and `web:haptic`'s style picks the
// impact to play — both now have their fields checked too.

test('parses a web:open-url with and without an appUrl', () => {
  expect(parseWebMessage(JSON.stringify({ type: 'web:open-url', url: 'https://x.test' }))).toStrictEqual({
    type: 'web:open-url',
    url: 'https://x.test',
  });
  const withApp = { type: 'web:open-url', url: 'https://open.spotify.com/track/x', appUrl: 'spotify:track:x' };
  expect(parseWebMessage(JSON.stringify(withApp))).toStrictEqual(withApp);
});

for (const [label, payload] of [
  ['a missing url', { type: 'web:open-url' }],
  ['an empty url', { type: 'web:open-url', url: '' }],
  ['an empty appUrl', { type: 'web:open-url', url: 'https://x.test', appUrl: '' }],
  ['a non-string appUrl', { type: 'web:open-url', url: 'https://x.test', appUrl: 1 }],
] as const) {
  test(`refuses a web:open-url with ${label}`, () => {
    expect(parseWebMessage(JSON.stringify(payload))).toBe(null);
  });
}

test('parses each web:haptic style and refuses any other', () => {
  for (const style of ['light', 'medium', 'heavy']) {
    expect(parseWebMessage(JSON.stringify({ type: 'web:haptic', style }))?.type).toBe('web:haptic');
  }
  for (const style of ['rigid', '', undefined, 3]) {
    expect(parseWebMessage(JSON.stringify({ type: 'web:haptic', style }))).toBe(null);
  }
});

test('refuses an unknown type', () => {
  expect(parseWebMessage(JSON.stringify({ type: 'web:teleport' }))).toBe(null);
});
