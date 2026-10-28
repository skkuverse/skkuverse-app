import { describe, it, expect } from 'vitest';
import type { TranslationKey } from '@skkuverse/shared';
import type { MiniAppFeedEntry, MiniAppIndexEntry } from '../web.types';
import { FRESH_WINDOW_MS } from './feed.constants';
import {
  decideEntryAction,
  decideFeedCard,
  hasFeedEntry,
  isFeedRefetchDue,
  isFreshEntry,
  toFeedAge,
  toFeedAgeText,
  toFeedItemAction,
  toFeedPush,
  toFeedScreenRows,
  toFeedScreenTitle,
  toFeedSectionTitle,
  toFreshEdge,
  toFreshRemainingMs,
  type DecideFeedCardInputs,
} from './feed.rules';
import type { MiniAppFeedScreenRow } from './feed.types';

const t = (key: TranslationKey): string => `<${key}>`;
const tpl = (key: TranslationKey, ...args: (string | number)[]): string => `<${key}:${args.join(',')}>`;

describe('toFeedAge', () => {
  const sent = Date.parse('2026-10-01T20:00:00+09:00');

  it('under a minute (and a slightly fast server clock) is "just now"', () => {
    // Act & Assert
    expect(toFeedAge(new Date(sent).toISOString(), sent + 59_000)).toEqual({ kind: 'justNow' });
    expect(toFeedAge(new Date(sent).toISOString(), sent - 30_000)).toEqual({ kind: 'justNow' });
  });

  it('minutes, then hours', () => {
    // Act & Assert
    expect(toFeedAge(new Date(sent).toISOString(), sent + 5 * 60_000)).toEqual({ kind: 'minutes', value: 5 });
    expect(toFeedAge(new Date(sent).toISOString(), sent + 59 * 60_000)).toEqual({ kind: 'minutes', value: 59 });
    expect(toFeedAge(new Date(sent).toISOString(), sent + 3 * 3_600_000)).toEqual({ kind: 'hours', value: 3 });
  });

  it('a day or more is a KST month/day', () => {
    // Act & Assert
    expect(toFeedAge(new Date(sent).toISOString(), sent + 25 * 3_600_000)).toEqual({
      kind: 'date',
      month: 10,
      day: 1,
    });
  });
});

describe('toFeedAgeText', () => {
  const sentAt = '2026-10-01T11:00:00.000Z';
  const sent = Date.parse(sentAt);

  it.each([
    ['just now', sent + 30_000, '<miniappFeed.justNow>'],
    ['minutes', sent + 5 * 60_000, '<miniappFeed.minutesAgo:5>'],
    ['hours', sent + 3 * 3_600_000, '<miniappFeed.hoursAgo:3>'],
    ['a KST date', sent + 25 * 3_600_000, '10/1'],
  ])('%s', (_case, now, expected) => {
    // Act
    const text = toFeedAgeText(sentAt, now, t, tpl);

    // Assert
    expect(text).toBe(expected);
  });
});

describe('isFreshEntry — the home card glows for 15 minutes', () => {
  const SENT = '2026-10-01T09:00:00.000Z';
  const sentMs = Date.parse(SENT);

  it.each([
    ['just sent: fresh', SENT, sentMs, undefined, true],
    ['14:59 later: still fresh', SENT, sentMs + 14 * 60_000 + 59_000, undefined, true],
    ['exactly 15:00 later: no longer fresh', SENT, sentMs + FRESH_WINDOW_MS, undefined, false],
    ['long past: not fresh', SENT, sentMs + 3 * 3600_000, undefined, false],
    // The server clock runs a little ahead: sentAt lands in our future.
    ['future timestamp from a fast server clock: fresh', SENT, sentMs - 20_000, undefined, true],
    ['invalid date: not fresh', 'not-a-date', sentMs, undefined, false],
    ['empty date: not fresh', '', sentMs, undefined, false],
    ['a custom window is honoured, inside', SENT, sentMs + 59_000, 60_000, true],
    ['a custom window is honoured, at its end', SENT, sentMs + 60_000, 60_000, false],
  ])('%s', (_case, sentAt, now, windowMs, expected) => {
    // Act
    const fresh = isFreshEntry(sentAt, now, windowMs);

    // Assert
    expect(fresh).toBe(expected);
  });
});

describe('isFeedRefetchDue — a return to home fetches unless the data is seconds old', () => {
  const NOW = Date.parse('2026-10-01T09:00:00.000Z');

  it.each([
    ['never fetched: due', 0, true],
    ['a second old: not due', NOW - 1_000, false],
    ['exactly five seconds old: not due', NOW - 5_000, false],
    ['just over five seconds old: due', NOW - 5_001, true],
  ])('%s', (_case, updatedAt, expected) => {
    // Act & Assert
    expect(isFeedRefetchDue(updatedAt, NOW)).toBe(expected);
  });
});

describe('toFreshRemainingMs — the timer that switches the glow off', () => {
  const SENT = '2026-10-01T09:00:00.000Z';
  const sentMs = Date.parse(SENT);

  it.each([
    ['counts down to the exact expiry, at once', SENT, sentMs, FRESH_WINDOW_MS],
    ['counts down to the exact expiry, a minute in', SENT, sentMs + 60_000, FRESH_WINDOW_MS - 60_000],
    ['includes the lead of a fast server clock', SENT, sentMs - 20_000, FRESH_WINDOW_MS + 20_000],
    ['never negative', SENT, sentMs + FRESH_WINDOW_MS + 1, 0],
    ['0 for an invalid date', 'garbage', sentMs, 0],
  ])('%s', (_case, sentAt, now, expected) => {
    // Act
    const left = toFreshRemainingMs(sentAt, now);

    // Assert
    expect(left).toBe(expected);
  });
});

describe("toFreshEdge — useClock's next edge for the glow", () => {
  const SENT = '2026-10-01T09:00:00.000Z';
  const sentMs = Date.parse(SENT);

  it.each([
    ['while fresh, the window end', SENT, sentMs + 60_000, sentMs + FRESH_WINDOW_MS],
    ['with a fast server clock, still the window end', SENT, sentMs - 20_000, sentMs + FRESH_WINDOW_MS],
    ['once the window closed, none', SENT, sentMs + FRESH_WINDOW_MS, null],
    ['with no entry, none', undefined, sentMs, null],
    ['for an invalid date, none', 'garbage', sentMs, null],
  ])('%s', (_case, sentAt, now, expected) => {
    // Act
    const edge = toFreshEdge(sentAt, now);

    // Assert
    expect(edge).toBe(expected);
  });
});

describe('toFeedPush — which pushes refresh a feed', () => {
  it.each<[string, Record<string, unknown> | undefined, ReturnType<typeof toFeedPush>]>([
    ['a mini-app push with its entry', { type: 'miniapp', miniAppId: 'eskara-2026', notificationId: 'n1' }, { miniAppId: 'eskara-2026', entryId: 'n1' }],
    ['a mini-app push without an entry id', { type: 'miniapp', miniAppId: 'eskara-2026' }, { miniAppId: 'eskara-2026', entryId: null }],
    ['an empty entry id: none', { type: 'miniapp', miniAppId: 'eskara-2026', notificationId: '' }, { miniAppId: 'eskara-2026', entryId: null }],
    ['a non-string entry id: none', { type: 'miniapp', miniAppId: 'eskara-2026', notificationId: 7 }, { miniAppId: 'eskara-2026', entryId: null }],
    ['another kind of push: none', { type: 'notice', miniAppId: 'eskara-2026' }, null],
    ['no mini-app id: none', { type: 'miniapp' }, null],
    ['an empty mini-app id: none', { type: 'miniapp', miniAppId: '' }, null],
    ['a non-string mini-app id: none', { type: 'miniapp', miniAppId: 3 }, null],
    ['no data: none', undefined, null],
  ])('%s', (_case, data, expected) => {
    // Act & Assert
    expect(toFeedPush(data)).toEqual(expected);
  });
});

describe('hasFeedEntry — whether the refetch already brought the pushed entry', () => {
  const entry: MiniAppFeedEntry = { id: 'n1', title: 'T', body: 'B', sentAt: '2026-10-01T09:00:00.000Z' };

  it.each<[string, MiniAppFeedEntry[] | undefined, boolean]>([
    ['listed: yes', [entry], true],
    ['not listed yet: no', [{ ...entry, id: 'n0' }], false],
    ['no data: no', undefined, false],
  ])('%s', (_case, entries, expected) => {
    // Act & Assert
    expect(hasFeedEntry(entries, 'n1')).toBe(expected);
  });
});

describe('the feed title, the same on home and on the screen', () => {
  const index: MiniAppIndexEntry[] = [
    { id: 'hssc', name: '인사캠 총학생회', shortName: '인사캠 총학', order: 1, homeLogo: null, shellLogo: null },
    { id: 'mukja', name: '음식 룰렛', order: 2, homeLogo: null, shellLogo: null },
  ];

  it('names ESKARA the same in both places', () => {
    // Act
    const section = toFeedSectionTitle('eskara-2026', 'Server title', t);
    const screen = toFeedScreenTitle('eskara-2026', index, t);

    // Assert
    expect(section).toBe('<eskaraPush.feedTitle>');
    expect(screen).toBe(section);
  });

  it.each([
    ["the server's section title", 'hssc', 'Server title', 'Server title'],
    ['the generic title without one', 'hssc', undefined, '<miniappFeed.title>'],
  ])('home uses %s for any other feed', (_case, miniAppId, sectionTitle, expected) => {
    // Act & Assert
    expect(toFeedSectionTitle(miniAppId, sectionTitle, t)).toBe(expected);
  });

  it.each([
    ['the short name', 'hssc', index, '인사캠 총학 <miniappFeed.title>'],
    ['the name without a short one', 'mukja', index, '음식 룰렛 <miniappFeed.title>'],
    ['the generic title for an unlisted id', 'other', index, '<miniappFeed.title>'],
    ['the generic title before the index loads', 'hssc', undefined, '<miniappFeed.title>'],
  ])('the screen uses %s for any other feed', (_case, miniAppId, entries, expected) => {
    // Act & Assert
    expect(toFeedScreenTitle(miniAppId, entries, t)).toBe(expected);
  });
});

describe('decideEntryAction', () => {
  const base: MiniAppFeedEntry = { id: 'n1', title: 'T', body: 'B', sentAt: '2026-10-01T09:00:00.000Z' };

  it.each<[string, Partial<MiniAppFeedEntry>, ReturnType<typeof decideEntryAction>]>([
    ['no action: the list', {}, { kind: 'list' }],
    ['a type without a value: the list', { actionType: 'miniapp' }, { kind: 'list' }],
    ['the route of its own list: the list', { actionType: 'route', actionValue: '/miniapp-feed/eskara-2026' }, { kind: 'list' }],
    ['a type this build cannot run: the list', { actionType: 'hologram', actionValue: 'x' }, { kind: 'list' }],
    [
      'a mini-app page: that page',
      { actionType: 'miniapp', actionValue: 'eskara-2026/map' },
      { kind: 'action', actionType: 'miniapp', actionValue: 'eskara-2026/map' },
    ],
    [
      'another route: that route',
      { actionType: 'route', actionValue: '/campus' },
      { kind: 'action', actionType: 'route', actionValue: '/campus' },
    ],
    [
      'the legacy url spelling: external',
      { actionType: 'url', actionValue: 'https://skku.edu' },
      { kind: 'action', actionType: 'external', actionValue: 'https://skku.edu' },
    ],
  ])('%s', (_case, action, expected) => {
    // Act & Assert
    expect(decideEntryAction({ ...base, ...action }, 'eskara-2026')).toEqual(expected);
  });
});

describe('decideEntryAction — a stored action is checked for shape before it runs', () => {
  const base: MiniAppFeedEntry = { id: 'n1', title: 'T', body: 'B', sentAt: '2026-10-01T09:00:00.000Z' };

  it.each([
    ['a protocol-relative URL', 'route', '//evil.com'],
    ['a backslash authority', 'route', '/\\evil.com'],
    ['a protocol-relative spelling later in the route', 'route', '/webview?url=https://evil.example'],
    ['a backslash later in the route', 'route', '/campus\\x'],
    ['a space', 'route', '/campus x'],
    ['a newline', 'route', '/campus\nx'],
    ['a control character', 'route', '/campus\u0007'],
    ['a route that is not a path', 'route', 'campus'],
    ['plain http', 'webview', 'http://x.test/a'],
    ['a script URL', 'external', 'javascript:alert(1)'],
    ['userinfo', 'webview', 'https://u:p@x.test/a'],
    ['an empty host', 'external', 'https://'],
    ['a mini-app target naming a game', 'miniapp', 'apple-game'],
    ['a mini-app target naming a game page', 'miniapp', 'suika-game/x'],
  ])('%s: the list', (_case, actionType, actionValue) => {
    // Act & Assert
    expect(decideEntryAction({ ...base, actionType, actionValue }, 'eskara-2026')).toEqual({ kind: 'list' });
  });

  it.each([
    ['the mini-app opener the ESKARA console stored', 'route', '/mini-app?id=timetable&source=push'],
    ['a route outside the push allowlist', 'route', '/notices/cse/5847'],
    ['an https page', 'webview', 'https://webview.skkuverse.com/eskara'],
    ['another mini app', 'miniapp', 'timetable'],
  ])('%s: still runs', (_case, actionType, actionValue) => {
    // Act & Assert
    expect(decideEntryAction({ ...base, actionType, actionValue }, 'eskara-2026')).toEqual({
      kind: 'action',
      actionType,
      actionValue,
    });
  });
});

describe('toFeedScreenRows', () => {
  const sentAt = '2026-10-01T09:00:00.000Z';
  const now = Date.parse(sentAt) + 5 * 60_000;

  it('words each entry\'s age, keeping the server\'s order', () => {
    // Arrange
    const entries: MiniAppFeedEntry[] = [
      { id: 'n2', title: 'T2', body: 'B2', sentAt },
      { id: 'n1', title: 'T1', body: 'B1', sentAt: '2026-09-30T09:00:00.000Z' },
    ];

    // Act
    const rows = toFeedScreenRows(entries, { miniAppId: 'eskara-2026', now, t, tpl });

    // Assert
    expect(rows.map((row) => [row.entry.id, row.timeText])).toEqual([
      ['n2', '<miniappFeed.minutesAgo:5>'],
      ['n1', '9/30'],
    ]);
  });

  it.each<[string, Partial<MiniAppFeedEntry>, MiniAppFeedScreenRow['action']]>([
    ['no action: not pressable', {}, null],
    ['a type without a value: not pressable', { actionType: 'miniapp' }, null],
    ['the route of its own list: not pressable', { actionType: 'route', actionValue: '/miniapp-feed/eskara-2026' }, null],
    ['a type this build cannot run: not pressable', { actionType: 'hologram', actionValue: 'x' }, null],
    [
      'a mini-app page: pressable, opening that page',
      { actionType: 'miniapp', actionValue: 'eskara-2026/map' },
      { kind: 'action', actionType: 'miniapp', actionValue: 'eskara-2026/map' },
    ],
  ])('%s', (_case, action, expected) => {
    // Arrange
    const entry: MiniAppFeedEntry = { id: 'n1', title: 'T', body: 'B', sentAt, ...action };

    // Act
    const [row] = toFeedScreenRows([entry], { miniAppId: 'eskara-2026', now, t, tpl });

    // Assert
    expect(row?.action).toEqual(expected);
  });
});

describe('toFeedItemAction — what a tap logs', () => {
  it.each([
    ['miniapp', 'miniapp'],
    ['route', 'route'],
    ['external', 'link'],
    ['webview', 'link'],
  ] as const)('%s logs %s', (actionType, expected) => {
    // Act & Assert
    expect(toFeedItemAction(actionType)).toBe(expected);
  });
});

describe("decideFeedCard — what home's card holds", () => {
  const latest: MiniAppFeedEntry = { id: 'n1', title: 'T', body: 'B', sentAt: '2026-10-01T09:00:00.000Z' };
  const sentMs = Date.parse(latest.sentAt);
  const base: DecideFeedCardInputs = {
    miniAppId: 'eskara-2026',
    title: 'Feed',
    miniAppSendsPush: true,
    deviceReceivesPush: true,
    permissionStatus: 'authorized',
    optedInHere: false,
    latest,
    now: sentMs + 5 * 60_000,
    freshNow: sentMs + 5 * 60_000,
    t,
    tpl,
  };
  const LATEST = {
    kind: 'latest',
    entryId: 'n1',
    title: 'T',
    body: '<miniappFeed.minutesAgo:5> · B',
    a11yLabel: 'Feed. T. B',
    fresh: true,
    action: { kind: 'list' },
  } as const;
  const ASK_ALLOW = {
    kind: 'askPush',
    title: '<miniappFeed.allowTitle>',
    body: '<miniappFeed.allowBody>',
    a11yLabel: 'Feed. <miniappFeed.allowTitle>',
  } as const;
  const ASK_ENABLE = {
    kind: 'askPush',
    title: '<miniappFeed.enableTitle>',
    body: '<miniappFeed.allowBody>',
    a11yLabel: 'Feed. <miniappFeed.enableTitle>',
  } as const;

  it.each<[string, Partial<DecideFeedCardInputs>, ReturnType<typeof decideFeedCard>]>([
    ['push on: the latest entry', {}, LATEST],
    ['no push for this mini app: never the ask', { miniAppSendsPush: false, deviceReceivesPush: false, permissionStatus: 'denied' }, LATEST],
    ['permission denied: the ask to allow', { deviceReceivesPush: false, permissionStatus: 'denied' }, ASK_ALLOW],
    ['permission not asked yet: the ask to allow', { deviceReceivesPush: false, permissionStatus: 'notDetermined' }, ASK_ALLOW],
    ['granted, not subscribed: the ask to turn on', { deviceReceivesPush: false }, ASK_ENABLE],
    ['granted and opted in here, preferences loading: no ask', { deviceReceivesPush: false, optedInHere: true }, LATEST],
    ['provisional and opted in here: no ask', { deviceReceivesPush: false, optedInHere: true, permissionStatus: 'provisional' }, LATEST],
    ['opted in here but denied: the ask to allow', { deviceReceivesPush: false, optedInHere: true, permissionStatus: 'denied' }, ASK_ALLOW],
    ['nothing sent yet: the empty line', { latest: undefined }, { kind: 'empty', body: '<miniappFeed.empty>', a11yLabel: 'Feed. <miniappFeed.empty>' }],
    ['a stale entry: no glow', { freshNow: sentMs + FRESH_WINDOW_MS }, { ...LATEST, fresh: false }],
    [
      'an entry with its own action: the card carries it',
      { latest: { ...latest, actionType: 'miniapp', actionValue: 'eskara-2026/map' } },
      { ...LATEST, action: { kind: 'action', actionType: 'miniapp', actionValue: 'eskara-2026/map' } },
    ],
  ])('%s', (_case, inputs, expected) => {
    // Act & Assert
    expect(decideFeedCard({ ...base, ...inputs })).toEqual(expected);
  });
});
