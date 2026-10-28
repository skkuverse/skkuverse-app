/**
 * Which server action targets the detail screen can open. A target outside
 * each kind's allowlist drops its action, since it becomes a URL the OS opens.
 */
import { describe, expect, it } from 'vitest';
import { toNoticeAction } from './notice-action.rules';
import type { NoticeActionKind } from './notice-facts.types';

describe('toNoticeAction', () => {
  it.each<[NoticeActionKind, string, unknown]>([
    ['map', 'skku_building:248', { kind: 'map', place: { kind: 'skku_building', placeId: '248' }, space: null }],
    ['map', 'building:hssc:109', null],
    ['map', 'bus_stop:hyehwa', null],
    ['map', 'event:booth-1', null],
    ['search', '  잠실 한국광고문화회관 ', { kind: 'search', query: '잠실 한국광고문화회관' }],
    ['search', '   ', null],
    ['call', '02-760-1234', { kind: 'call', number: '02-760-1234' }],
    ['call', '+82 2 760 1234', { kind: 'call', number: '+82 2 760 1234' }],
    ['call', '760-123', null],
    ['call', '02-760-1234; rm', null],
    ['email', 'contact@example.com', { kind: 'email', address: 'contact@example.com', subject: null }],
    ['email', 'a@b.com?cc=x@y.com', null],
    ['email', 'a b@c.com', null],
    ['email', 'not-an-address', null],
    ['link', 'https://forms.gle/x', { kind: 'link', url: 'https://forms.gle/x' }],
    ['link', 'http://skku.edu', { kind: 'link', url: 'http://skku.edu' }],
    ['link', 'javascript:alert(1)', null],
    ['link', 'https://a.com/ b', null],
  ])('%s %j', (kind, target, expected) => {
    // Act
    const action = toNoticeAction(kind, { target });

    // Assert
    expect(action).toStrictEqual(expected);
  });

  it('carries a map space and an e-mail subject', () => {
    // Act
    const map = toNoticeAction('map', { target: 'skku_building:248', space: '21517' });
    const email = toNoticeAction('email', { target: 'a@skku.edu', subject: '[지원] 이름' });

    // Assert
    expect(map).toStrictEqual({ kind: 'map', place: { kind: 'skku_building', placeId: '248' }, space: '21517' });
    expect(email).toStrictEqual({ kind: 'email', address: 'a@skku.edu', subject: '[지원] 이름' });
  });
});
