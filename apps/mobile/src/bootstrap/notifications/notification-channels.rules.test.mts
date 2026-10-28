import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_CHANNELS,
  NotificationChannelId,
  mapCategoryToChannel,
  resolveNotificationChannel,
} from './notification-channels.rules.ts';

describe('mapCategoryToChannel', () => {
  test('board categories land in their own channel', () => {
    assert.equal(mapCategoryToChannel('학사'), NotificationChannelId.ACADEMIC);
    assert.equal(mapCategoryToChannel('장학'), NotificationChannelId.SCHOLARSHIP);
    assert.equal(mapCategoryToChannel('채용/모집'), NotificationChannelId.CAREER);
  });

  test('anything unlisted falls back to GENERAL', () => {
    for (const category of [undefined, '', '일반', 'constructor', '__proto__']) {
      assert.equal(mapCategoryToChannel(category), NotificationChannelId.GENERAL, String(category));
    }
  });

  test('every mapped channel is one the app registers', () => {
    const registered = new Set<string>(Object.values(NotificationChannelId));
    for (const channel of CATEGORY_CHANNELS.values()) {
      assert.ok(registered.has(channel), channel);
    }
  });
});

describe('resolveNotificationChannel', () => {
  test('a mini app goes to its channel whatever the category', () => {
    assert.equal(resolveNotificationChannel({ type: 'miniapp', category: '학사' }), NotificationChannelId.MINIAPP);
  });

  test('a notice goes by its category, and a non-string one is ignored', () => {
    assert.equal(resolveNotificationChannel({ type: 'notice', category: '학사' }), NotificationChannelId.ACADEMIC);
    assert.equal(resolveNotificationChannel({ type: 'notice', category: 3 }), NotificationChannelId.GENERAL);
    assert.equal(resolveNotificationChannel(undefined), NotificationChannelId.GENERAL);
  });
});
