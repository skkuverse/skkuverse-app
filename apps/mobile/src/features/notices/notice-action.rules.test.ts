/**
 * Which server action targets the detail screen can open. A target outside
 * each kind's allowlist drops its action, since it becomes a URL the OS opens.
 * Then what a tap hands to the OS, and what it copies when no app takes it.
 */
import { describe, expect, it } from 'vitest';
import { toActionHandoff, toNoticeAction } from './notice-action.rules';
import type { NoticeAction, NoticeActionKind } from './notice-facts.types';

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

describe('toActionHandoff', () => {
  const campus = { kind: 'skku_building', placeId: '248' } as const;

  it.each<[string, NoticeAction, 'ios' | 'android', unknown]>([
    ['a campus place opens the campus map', { kind: 'map', place: campus, space: '21517' }, 'ios', { via: 'map', place: campus, space: '21517' }],
    [
      'a place off campus searches Apple Maps',
      { kind: 'search', query: '잠실 한국광고문화회관 2층' },
      'ios',
      { via: 'url', url: 'maps://?q=%EC%9E%A0%EC%8B%A4%20%ED%95%9C%EA%B5%AD%EA%B4%91%EA%B3%A0%EB%AC%B8%ED%99%94%ED%9A%8C%EA%B4%80%202%EC%B8%B5', copyOnFailure: '잠실 한국광고문화회관 2층' },
    ],
    [
      'a place off campus searches the Android map app',
      { kind: 'search', query: 'A&B?' },
      'android',
      { via: 'url', url: 'geo:0,0?q=A%26B%3F', copyOnFailure: 'A&B?' },
    ],
    [
      'a number dials its digits alone',
      { kind: 'call', number: '+82 2-760-1234' },
      'ios',
      { via: 'url', url: 'tel:+8227601234', copyOnFailure: '+82 2-760-1234' },
    ],
    [
      'an address with no subject',
      { kind: 'email', address: 'a@skku.edu', subject: null },
      'android',
      { via: 'url', url: 'mailto:a@skku.edu', copyOnFailure: 'a@skku.edu' },
    ],
    [
      'an address with a subject that needs encoding',
      { kind: 'email', address: 'a@skku.edu', subject: '[지원] 홍길동 & 학번?' },
      'ios',
      {
        via: 'url',
        url: 'mailto:a@skku.edu?subject=%5B%EC%A7%80%EC%9B%90%5D%20%ED%99%8D%EA%B8%B8%EB%8F%99%20%26%20%ED%95%99%EB%B2%88%3F',
        copyOnFailure: 'a@skku.edu',
      },
    ],
    ['a link opens as sent', { kind: 'link', url: 'https://forms.gle/x' }, 'android', { via: 'url', url: 'https://forms.gle/x', copyOnFailure: null }],
  ])('%s', (_name, action, os, expected) => {
    // Act
    const handoff = toActionHandoff(action, os);

    // Assert
    expect(handoff).toStrictEqual(expected);
  });
});
