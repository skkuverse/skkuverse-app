import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HANDLED_RESPONSES,
  rememberHandled,
  shouldHandleResponse,
} from './notification-response.rules.ts';

describe('shouldHandleResponse', () => {
  test('a tap on a notification FCM drew belongs to RNFB', () => {
    assert.equal(shouldHandleResponse('push', 'a', []), false);
  });

  test('a tap on a notification the app drew is handled once', () => {
    // Android reports an immediate {channelId} trigger with no type.
    assert.equal(shouldHandleResponse(undefined, 'a', []), true);
    assert.equal(shouldHandleResponse(undefined, 'a', ['a']), false);
  });

  test('an earlier handled tap does not hide a new one', () => {
    assert.equal(shouldHandleResponse(undefined, 'b', ['a']), true);
  });
});

describe('rememberHandled', () => {
  test('appends, and a repeated identifier is not stored twice', () => {
    assert.deepEqual(rememberHandled(['a', 'b'], 'a'), ['b', 'a']);
  });

  test('keeps only the newest identifiers past the cap', () => {
    let handled: string[] = [];
    for (let i = 0; i < MAX_HANDLED_RESPONSES + 5; i++) {
      handled = rememberHandled(handled, String(i));
    }
    assert.equal(handled.length, MAX_HANDLED_RESPONSES);
    assert.equal(handled[0], '5');
    assert.equal(handled.at(-1), String(MAX_HANDLED_RESPONSES + 4));
  });
});
