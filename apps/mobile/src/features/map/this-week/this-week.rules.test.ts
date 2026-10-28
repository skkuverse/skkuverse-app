/**
 * 이번 주 캠퍼스's decisions (umbrella ADR 0010): the real weeks the study
 * rendered, read back row by row, and hand-made items for each rule's edges.
 */

import { describe, expect, it } from 'vitest';
import { translations } from '../../../../../../packages/shared/src/i18n/translations';
import type { TranslationKey } from '@skkuverse/shared';
import busy from './__fixtures__/this-week-2026-10-26.mock.json';
import quiet from './__fixtures__/this-week-2026-10-19.mock.json';
import { parseThisWeekFeed } from './this-week.schema';
import {
  SHEET_ROWS,
  decideQualifier,
  decideSignUp,
  decideToken,
  decideWhen,
  isInPool,
  mapRootSheetOf,
  toBuildingCounts,
  toEmptyLineText,
  toGroupLabelText,
  toNextMonday,
  toPlaceText,
  toQualifierText,
  toRowText,
  toSectionTexts,
  toSheetFeed,
  toThisWeekFeed,
  toThumbnail,
  toThumbnailFrame,
  toWhenLine,
  toWhenText,
} from './this-week.rules';
import type { ThisWeekFeed, ThisWeekItem, ThisWeekScreenFeed, ThisWeekScreenRow, ThisWeekSession } from './this-week.types';

const KO = translations.ko;
const t = (key: TranslationKey) => KO[key];
const tpl = (key: TranslationKey, ...args: (string | number)[]) =>
  args.reduce<string>((text, arg, i) => text.replace(`{${i}}`, String(arg)), KO[key]);

function load(raw: unknown): ThisWeekFeed {
  const feed = parseThisWeekFeed(raw);
  if (feed === null) throw new Error('fixture has no clock');
  return feed;
}

const BUSY = load(busy);
const QUIET = load(quiet);

/** A row as the view draws it: line 1 | line 2's two units | the place line. */
function toLine(row: ThisWeekScreenRow): string {
  const words = toRowText(row, t, tpl);
  const head = words.token ? `${words.token} · ${row.title}` : row.title;
  const q = words.qualifier ? ` · ${words.qualifier.tone === 'benefit' ? '🎁 ' : ''}${words.qualifier.text}` : '';
  return `${head} | ${words.when}${q} | ${words.place}`;
}

/** The feed as text: each section's label or empty line, then its rows. */
function toText(feed: ThisWeekScreenFeed): string[] {
  if (feed.kind === 'empty') return ['(empty)'];
  return feed.sections.flatMap((s) => [
    `# ${toGroupLabelText(s.group, feed.nextMonday, t, tpl)}`,
    ...(s.emptyLine ? [`- ${toEmptyLineText(s.emptyLine, t)}`] : []),
    ...s.rows.map(toLine),
  ]);
}

// 2026-10-26 09:00 KST, a Monday.
const NOW = Date.parse('2026-10-26T09:00:00+09:00');
const at = (iso: string) => Date.parse(`${iso}+09:00`);

const session = (over: Partial<ThisWeekSession> = {}): ThisWeekSession => ({
  name: '설명회',
  startAt: at('2026-10-28T15:00:00'),
  endAt: at('2026-10-28T16:30:00'),
  timeKnown: true,
  places: [{ skkuId: 12, buildingName: '경영관', room: '33101' }],
  ...over,
});

const item = (over: Partial<ThisWeekItem> = {}): ThisWeekItem => ({
  id: 'n1:hssc',
  sourceId: 'skku-main',
  articleNo: 1,
  campus: 'hssc',
  kind: 'event',
  title: '국가고시 설명회 안내',
  shortTitle: '국가고시 설명회',
  restriction: null,
  benefit: null,
  signUp: { status: 'none', windows: [] },
  sessions: [session()],
  imageUrl: null,
  ...over,
});

function rowsOf(feed: ThisWeekScreenFeed): ThisWeekScreenRow[] {
  return feed.kind === 'empty' ? [] : feed.sections.flatMap((s) => s.rows);
}

// Rows with a token differ from renderings.md where ADR 0010 D5 caps their title at 14 characters.
describe('the study’s weeks, read back (renderings.md, structure A)', () => {
  it('10/26 인사캠: 오늘, 이번 주 and 다음 주, by start then title', () => {
    // Act
    const text = toText(toThisWeekFeed(BUSY.items, 'hssc', BUSY.now));

    // Assert
    expect(text).toStrictEqual([
      '# 오늘',
      '신청 마감됨 · 교환학생 설명회·Mobility… | 13시 시작 외 1회 · 🎁 경품 추첨 | 국제관',
      '# 이번 주 · ~11/1(일)',
      '소셜이노베이션 취창업 콜로키움 | 내일 10:30 시작 | 수선관 사회과학연구원 컨퍼런스 룸',
      '자기이해 집단상담 | 10/28(수)부터 11/25(수)까지 · 오늘 17시 신청 마감 | 다산경제관',
      '관계 속 나 집단상담 | 10/28(수) 13:30 시작 외 1회 · 오늘 10시 신청 마감 | 다산경제관',
      '신청 마감됨 · 국가고시·전문자격증 설명회 | 10/28(수) 15시 시작 외 1회 · 🎁 국가고시 길라잡이 책자·기념품 | 경영관',
      '무역금융 특강 | 10/29(목) 15시 시작 · 🎁 추첨 경품 | 경영관',
      '# 다음 주 · 11/2(월)~',
      'AICOSS 사업단 설명회 | 11/2(월) 진행 · 🎁 해외 여행용 멀티 어댑터 | 호암관',
      '졸업앨범 추가 촬영 | 11/2(월) 진행 · 졸업예정자 대상 | 경영관',
      '모집 중 · 성균인의 자기이해… | 11/2(월) 15시 시작 · 🎁 창의품 2시간 부여 | 국제관 외 2곳',
      '신경경제학 특강 | 11/3(화) 10:30 시작 | 국제관 첨단강의실',
      '삼양그룹 임원 설명회 | 11/3(화) 16:30 시작 · 🎁 에어팟 추첨 | 경영관',
      '졸업선배 릴레이 특강 | 11/3(화) 19시 시작 · 🎁 창의품 인증 가능 비교과 이수시간 | 경영관',
      '규제정책과 정치의 효능 | 11/4(수) 14시 시작 · 11/3(화) 신청 마감 | 국제관',
    ]);
  });

  it('10/26 자과캠: closed calls gone, a long operation last in 이번 주, no 다음 주', () => {
    // Act
    const text = toText(toThisWeekFeed(BUSY.items, 'nsc', BUSY.now));

    // Assert
    expect(text).toStrictEqual([
      '# 오늘',
      '모집 중 · 뇌영상 연구대상자 모집 | 15:55까지 진행 중 외 1회 · 🎁 교통비 10만원 | N센터',
      '졸업선배 릴레이 특강 | 18:30 시작 · 🎁 창의품 인증 가능 비교과 이수시간 | 제2과학관32동',
      '# 이번 주 · ~11/1(일)',
      '모집 중 · 검도 재능 기부 프로그램 | 내일 진행 외 3회 · 🎁 창의품 16시간 | 수성관',
      '모집 중 · 농구 재능 기부 프로그램 | 내일부터 12/3(목)까지 · 🎁 창의품 10시간 | 체육관',
      '신청 마감됨 · 교환학생 설명회·Mobility… | 내일 11:30 시작 외 1회 · 🎁 경품 추첨 | 삼성학술정보관 외 1곳',
      '졸업앨범 추가 촬영 | 10/29(목) 진행 · 졸업예정자 대상 | 학생회관',
      '스벤 리딘 원장 특별 강연 | 10/30(금) 14시 시작 | 삼성학술정보관 오디토리움',
      '양자정보세미나 | 10/30(금) 14시 시작 · 10/28(수) 신청 마감 | 반도체관',
      '학생성공스토리 특강 | 10/30(금) 14시 시작 · 10/28(수) 신청 마감 | 제2공학관27동',
      '신청 마감됨 · 국가고시·전문자격증 설명회 | 10/30(금) 15시 시작 외 1회 · 🎁 국가고시 길라잡이 책자·기념품 | 제2공학관26동',
      '통학 셔틀버스 시범운행 | 12/18(금)까지 운행 · 🎁 시범운행 기간 무료 이용 | N센터 외 3곳',
    ]);
  });

  it('10/19 인사캠: an empty 오늘 says so in one line', () => {
    // Act
    const text = toText(toThisWeekFeed(QUIET.items, 'hssc', QUIET.now));

    // Assert
    expect(text).toStrictEqual([
      '# 오늘',
      '- 오늘은 잡힌 일정이 없어요',
      '# 이번 주 · ~10/25(일)',
      '수선포럼 | 10/21(수) 11:30 시작 | 수선관 사회과학연구원 컨퍼런스 룸',
      'AI in Higher Education | 10/23(금) 13시 시작 · 🎁 참가확인증 발급 | 600주년기념관',
      '유학대학 80주년 특별 강연 | 10/23(금)까지 진행 | 퇴계인문관 첨단e+강의실(31409)',
      '# 다음 주 · 10/26(월)~',
      '국가고시·전문자격증 설명회 | 10/28(수) 15시 시작 · 10/25(일) 신청 마감 | 경영관',
      '무역금융 특강 | 10/29(목) 15시 시작 · 🎁 추첨 경품 | 경영관',
    ]);
  });

  it('10/19 자과캠: an empty 오늘 and 이번 주 say so in one line, then 다음 주', () => {
    // Act
    const text = toText(toThisWeekFeed(QUIET.items, 'nsc', QUIET.now));

    // Assert
    expect(text).toStrictEqual([
      '# 이번 주 · ~10/25(일)',
      '- 이번 주에는 잡힌 일정이 없어요',
      '# 다음 주 · 10/26(월)~',
      '졸업선배 릴레이 특강 | 10/26(월) 18:30 시작 · 🎁 창의품 인증 가능 비교과 이수시간 | 제2과학관32동',
      '모집 중 · 검도 재능 기부 프로그램 | 10/27(화) 진행 외 1회 · 🎁 창의품 16시간 | 수성관',
      '모집 중 · 농구 재능 기부 프로그램 | 10/27(화)부터 12/3(목)까지 · 🎁 창의품 10시간 | 체육관',
      '졸업앨범 추가 촬영 | 10/29(목) 진행 · 졸업예정자 대상 | 학생회관',
      '바이브코딩으로 게임 만들기 | 10/30(금) 13시 시작 · 10/22(목) 신청 마감 | 삼성학술정보관',
      '스벤 리딘 원장 특별 강연 | 10/30(금) 14시 시작 | 삼성학술정보관 오디토리움',
      '양자정보세미나 | 10/30(금) 14시 시작 · 10/28(수) 신청 마감 | 반도체관',
      '학생성공스토리 특강 | 10/30(금) 14시 시작 · 10/28(수) 신청 마감 | 제2공학관27동',
      '국가고시·전문자격증 설명회 | 10/30(금) 15시 시작 · 10/25(일) 신청 마감 | 제2공학관26동',
    ]);
  });

  it('gives each notice one row per campus', () => {
    for (const campus of ['hssc', 'nsc'] as const) {
      // Act
      const rows = rowsOf(toThisWeekFeed(BUSY.items, campus, BUSY.now));

      // Assert
      expect(new Set(rows.map((r) => `${r.item.sourceId}/${r.item.articleNo}`)).size).toBe(rows.length);
    }
  });
});

describe('isInPool: events, operations and open calls with a session ahead (D2, D10)', () => {
  it.each([
    ['an event', item(), true],
    ['an operation', item({ kind: 'operation' }), true],
    ['a call with no window', item({ kind: 'call' }), true],
    ['a job', item({ kind: 'job' }), false],
    ['a staff notice', item({ kind: 'staff' }), false],
    ['another campus', item({ campus: 'nsc' }), false],
    ['a call whose window closed', item({ kind: 'call', signUp: { status: 'dated', windows: [{ startAt: null, endAt: at('2026-10-22T18:00:00') }] } }), false],
    ['a call titled (마감)', item({ kind: 'call', title: '서포터즈 모집 (마감)' }), false],
    ['a call titled 모집마감', item({ kind: 'call', title: '[모집마감] 서포터즈 모집' }), false],
    ['an event whose own sign-up closed', item({ signUp: { status: 'dated', windows: [{ startAt: null, endAt: at('2026-10-25T18:00:00') }] } }), true],
    ['an event whose last session ended', item({ sessions: [session({ startAt: at('2026-10-24T10:00:00'), endAt: at('2026-10-24T12:00:00') })] }), false],
    ['an event after next week', item({ sessions: [session({ startAt: at('2026-11-09T10:00:00'), endAt: at('2026-11-09T12:00:00') })] }), false],
    ['an event on the last day of next week', item({ sessions: [session({ startAt: at('2026-11-08T23:00:00'), endAt: null })] }), true],
  ])('%s: %s', (_, candidate, inPool) => {
    // Act & Assert
    expect(isInPool(candidate, 'hssc', NOW)).toBe(inPool);
  });
});

describe('toThisWeekFeed: groups and order (D3, D4, D10)', () => {
  const titled = (title: string, s: Partial<ThisWeekSession>) =>
    item({ id: title, articleNo: title.length, shortTitle: title, sessions: [session(s)] });

  it('files each row by its next session: today or on now, before next Monday, next week', () => {
    // Arrange
    const items = [
      titled('다음주', { startAt: at('2026-11-02T10:00:00'), endAt: null }),
      titled('수요일', { startAt: at('2026-10-28T10:00:00'), endAt: null }),
      titled('오늘밤', { startAt: at('2026-10-26T19:00:00'), endAt: null }),
      titled('진행중', { startAt: at('2026-10-26T08:00:00'), endAt: at('2026-10-26T12:00:00') }),
      titled('일요일', { startAt: at('2026-11-01T23:00:00'), endAt: null }),
    ];

    // Act
    const feed = toThisWeekFeed(items, 'hssc', NOW);

    // Assert
    expect(feed.kind === 'sections' && feed.sections.map((s) => [s.group, s.rows.map((r) => r.title)])).toStrictEqual([
      ['today', ['진행중', '오늘밤']],
      ['thisWeek', ['수요일', '일요일']],
      ['nextWeek', ['다음주']],
    ]);
  });

  it('orders one start by title, and puts a long range begun before today last in 이번 주, never in 오늘', () => {
    // Arrange
    const items = [
      titled('나 특강', { startAt: at('2026-10-27T14:00:00'), endAt: null }),
      titled('가 특강', { startAt: at('2026-10-27T14:00:00'), endAt: null }),
      titled('긴 전시', { startAt: at('2026-10-01T00:00:00'), endAt: at('2026-11-30T00:00:00'), timeKnown: false }),
      titled('짧은 전시', { startAt: at('2026-10-25T00:00:00'), endAt: at('2026-10-28T00:00:00'), timeKnown: false }),
    ];

    // Act
    const feed = toThisWeekFeed(items, 'hssc', NOW);

    // Assert
    expect(feed.kind === 'sections' && feed.sections.map((s) => [s.group, s.rows.map((r) => r.title)])).toStrictEqual([
      ['today', ['짧은 전시']],
      ['thisWeek', ['가 특강', '나 특강', '긴 전시']],
    ]);
  });

  it('moves a row to its next session once one ends, and drops it after the last', () => {
    // Arrange
    const series = item({
      sessions: [
        session({ startAt: at('2026-10-26T10:00:00'), endAt: at('2026-10-26T11:00:00') }),
        session({ startAt: at('2026-10-29T10:00:00'), endAt: at('2026-10-29T11:00:00') }),
      ],
    });

    // Act
    const during = rowsOf(toThisWeekFeed([series], 'hssc', at('2026-10-26T10:30:00')));
    const between = rowsOf(toThisWeekFeed([series], 'hssc', at('2026-10-26T11:00:00')));
    const after = toThisWeekFeed([series], 'hssc', at('2026-10-29T11:00:00'));

    // Assert
    expect(during.map((r) => [toWhenLine(r, t, tpl)])).toStrictEqual([['11:00까지 진행 중 외 1회']]);
    expect(between.map((r) => toWhenLine(r, t, tpl))).toStrictEqual(['10/29(목) 10시 시작']);
    expect(after.kind).toBe('empty');
  });
});

describe('the empty states (D9)', () => {
  const on = (iso: string) => item({ sessions: [session({ startAt: at(iso), endAt: null })] });

  it.each([
    ['nothing at all', [], ['(empty)']],
    ['nothing today', [on('2026-10-28T10:00:00')], ['today:today', 'thisWeek']],
    ['nothing today or this week', [on('2026-11-03T10:00:00')], ['thisWeek:thisWeek', 'nextWeek']],
    ['nothing next week', [on('2026-10-26T18:00:00')], ['today']],
  ])('%s', (_, items, shape) => {
    // Act
    const feed = toThisWeekFeed(items, 'hssc', NOW);

    // Assert
    expect(
      feed.kind === 'empty' ? ['(empty)'] : feed.sections.map((s) => (s.emptyLine ? `${s.group}:${s.emptyLine}` : s.group)),
    ).toStrictEqual(shape);
  });

  it('words the two lines as the ADR does', () => {
    // Act & Assert
    expect(toEmptyLineText('today', t)).toBe('오늘은 잡힌 일정이 없어요');
    expect(toEmptyLineText('thisWeek', t)).toBe('이번 주에는 잡힌 일정이 없어요');
  });
});

describe('decideWhen and toWhenText: a date always with its verb (D5)', () => {
  const when = (s: Partial<ThisWeekSession>, over: Partial<ThisWeekItem> = {}, inToday = false) => {
    const next = session(s);
    return toWhenText(decideWhen(item({ ...over, sessions: [next] }), next, NOW, inToday), t, tpl);
  };

  it.each([
    ['a start time', when({ startAt: at('2026-10-29T18:00:00'), endAt: null }), '10/29(목) 18시 시작'],
    ['a start off the hour, tomorrow', when({ startAt: at('2026-10-27T10:30:00'), endAt: null }), '내일 10:30 시작'],
    ['a start under 오늘, without the day', when({ startAt: at('2026-10-26T18:30:00'), endAt: null }, {}, true), '18:30 시작'],
    ['a day with no time', when({ startAt: at('2026-11-02T00:00:00'), endAt: at('2026-11-03T00:00:00'), timeKnown: false }), '11/2(월) 진행'],
    ['a range ahead', when({ startAt: at('2026-10-28T10:00:00'), endAt: at('2026-11-25T13:00:00') }), '10/28(수)부터 11/25(수)까지'],
    ['a range under way', when({ startAt: at('2026-10-20T00:00:00'), endAt: at('2026-10-31T00:00:00'), timeKnown: false }), '10/30(금)까지 진행'],
    ['on now', when({ startAt: at('2026-10-26T08:00:00'), endAt: at('2026-10-26T16:00:00') }), '16:00까지 진행 중'],
    ['an untimed day under way', when({ startAt: at('2026-10-26T00:00:00'), endAt: null, timeKnown: false }), '오늘 진행'],
    ['a closure', when({ name: '교무팀 창구 휴무', startAt: at('2026-10-30T00:00:00'), endAt: null, timeKnown: false }, { kind: 'operation' }), '10/30(금) 휴무'],
    ['short hours under way', when({ name: '단축운영', startAt: at('2026-10-26T00:00:00'), endAt: at('2026-10-28T00:00:00'), timeKnown: false }, { kind: 'operation' }), '내일까지 단축 운영'],
    ['a service ahead', when({ name: '셔틀 운행', startAt: at('2026-10-28T00:00:00'), endAt: at('2026-11-07T00:00:00'), timeKnown: false }, { kind: 'operation' }), '10/28(수)~11/6(금) 운행'],
    ['an opening', when({ name: '팝업스토어', startAt: at('2026-10-28T11:00:00'), endAt: at('2026-10-28T17:00:00') }, { kind: 'operation' }), '10/28(수) 운영'],
  ])('%s', (_, text, expected) => {
    // Assert
    expect(text).toBe(expected);
  });
});

describe('decideSignUp, decideToken and decideQualifier: line 1’s token and line 2’s one qualifier (D2, D5)', () => {
  const window = (startAt: string | null, endAt: string | null) => ({
    startAt: startAt === null ? null : at(startAt),
    endAt: endAt === null ? null : at(endAt),
  });
  const EVENT_START = at('2026-10-30T14:00:00');
  const evented = (over: Partial<ThisWeekItem>) => item({ sessions: [session({ startAt: EVENT_START, endAt: null })], ...over });
  const qualifier = (candidate: ThisWeekItem, room: string | null = '33101') => {
    const q = decideQualifier(candidate, decideSignUp(candidate, EVENT_START, NOW), room, NOW);
    return q === null ? null : toQualifierText(q, t, tpl);
  };

  it('takes a restriction first, over a sign-up and a benefit', () => {
    // Arrange
    const candidate = evented({
      restriction: '졸업예정자',
      benefit: '기념품',
      signUp: { status: 'dated', windows: [window(null, '2026-10-27T18:00:00')] },
    });

    // Act & Assert
    expect(qualifier(candidate)).toBe('졸업예정자 대상');
  });

  it('takes the sign-up next, red today and tomorrow, with its hour only today and not at the day’s end', () => {
    // Arrange
    const closes = (end: string) => evented({ benefit: '기념품', signUp: { status: 'dated', windows: [window(null, end)] } });

    // Act
    const today = decideQualifier(closes('2026-10-26T17:00:00'), decideSignUp(closes('2026-10-26T17:00:00'), EVENT_START, NOW), null, NOW);
    const midnight = closes('2026-10-28T00:00:00');
    const later = closes('2026-10-28T17:00:00');
    const tonight = closes('2026-10-26T23:59:00');

    // Assert
    expect(today && toQualifierText(today, t, tpl)).toBe('오늘 17시 신청 마감');
    expect(today?.kind === 'signUpCloses' && today.urgent).toBe(true);
    expect(qualifier(midnight)).toBe('내일 신청 마감');
    expect(decideQualifier(midnight, decideSignUp(midnight, EVENT_START, NOW), null, NOW)).toMatchObject({ urgent: true });
    expect(qualifier(later)).toBe('10/28(수) 신청 마감');
    expect(decideQualifier(later, decideSignUp(later, EVENT_START, NOW), null, NOW)).toMatchObject({ urgent: false });
    expect(qualifier(tonight)).toBe('오늘 신청 마감');
  });

  it('says when a sign-up opens', () => {
    // Arrange
    const candidate = evented({ signUp: { status: 'dated', windows: [window('2026-10-27T09:00:00', '2026-10-29T18:00:00')] } });

    // Act & Assert
    expect(qualifier(candidate)).toBe('내일 신청 시작');
  });

  it('ignores a window that closes after the event starts: it opens something else', () => {
    // Arrange
    const candidate = evented({ benefit: '신입생 장학금', signUp: { status: 'dated', windows: [window(null, '2026-11-13T18:00:00')] } });

    // Act & Assert
    expect(decideSignUp(candidate, EVENT_START, NOW)).toBeNull();
    expect(qualifier(candidate)).toBe('신입생 장학금');
  });

  it('keeps the benefit verbatim, a draw still a draw, and falls back to the room', () => {
    // Act & Assert
    expect(qualifier(evented({ benefit: '에어팟 추첨' }))).toBe('에어팟 추첨');
    expect(qualifier(evented({}))).toBe('33101');
    expect(qualifier(evented({}), null)).toBeNull();
  });

  it.each([
    ['an event whose own sign-up closed', evented({ signUp: { status: 'dated', windows: [window(null, '2026-10-25T18:00:00')] } }), 'signUpClosed'],
    ['an event titled (마감)', evented({ title: '특강 (마감)' }), 'signUpClosed'],
    ['an event with an open sign-up', evented({ signUp: { status: 'dated', windows: [window(null, '2026-10-28T18:00:00')] } }), null],
    ['a call with no dated window', evented({ kind: 'call' }), 'recruiting'],
    ['a call open with no deadline', evented({ kind: 'call', signUp: { status: 'dated', windows: [window('2026-10-01T00:00:00', null)] } }), 'recruiting'],
    ['a call with a deadline', evented({ kind: 'call', signUp: { status: 'dated', windows: [window(null, '2026-10-28T18:00:00')] } }), null],
  ])('token for %s', (_, candidate, token) => {
    // Act & Assert
    expect(decideToken(candidate, decideSignUp(candidate, EVENT_START, NOW))).toBe(token);
  });
});

describe('a row’s place and picture', () => {
  it('names the first building, its room when the room is the qualifier, and counts the rest, from the sessions ahead only', () => {
    // Arrange
    const candidate = item({
      sessions: [
        session({ startAt: at('2026-10-20T10:00:00'), endAt: null, places: [{ skkuId: 2, buildingName: '600주년기념관', room: null }] }),
        session({ places: [{ skkuId: 9, buildingName: '국제관', room: '9B217' }, { skkuId: 12, buildingName: '경영관', room: null }] }),
        session({ startAt: at('2026-10-29T10:00:00'), endAt: null, places: [{ skkuId: 12, buildingName: '경영관', room: null }] }),
      ],
    });

    // Act
    const [row] = rowsOf(toThisWeekFeed([candidate], 'hssc', NOW));

    // Assert
    expect(toPlaceText(row, tpl)).toBe('국제관 9B217 외 1곳');
    expect(row.buildingIds).toStrictEqual([9, 12]);
    expect(row.qualifier).toStrictEqual({ kind: 'room', room: '9B217' });
    expect(row.moreSessions).toBe(1);
  });

  it('shows the notice’s own image or its kind’s icon, never a building photo', () => {
    // Act & Assert
    expect(toThumbnail(item({ imageUrl: 'https://x/poster.jpg' }), false)).toStrictEqual({ kind: 'image', url: 'https://x/poster.jpg' });
    expect(toThumbnail(item({ imageUrl: 'https://x/poster.jpg' }), true)).toStrictEqual({ kind: 'icon', itemKind: 'event' });
    expect(toThumbnail(item({ kind: 'call' }), false)).toStrictEqual({ kind: 'icon', itemKind: 'call' });
    expect(toThumbnail(item({ kind: 'operation' }), false)).toStrictEqual({ kind: 'icon', itemKind: 'operation' });
  });

  it('keeps a portrait at its shape and covers with anything else', () => {
    // Act & Assert
    expect(toThumbnailFrame(null)).toStrictEqual({ kind: 'pending' });
    expect(toThumbnailFrame(0.7)).toStrictEqual({ kind: 'portrait', aspectRatio: 0.7 });
    expect(toThumbnailFrame(1.5)).toStrictEqual({ kind: 'cover' });
  });
});

describe('toSheetFeed: the sheet is the page’s first rows, in the same groups and order (D7)', () => {
  it('cuts after the sheet’s rows and says a 더보기 follows', () => {
    // Arrange
    const page = toThisWeekFeed(BUSY.items, 'hssc', BUSY.now);

    // Act
    const { feed, hasMore, moreCount } = toSheetFeed(page);

    // Assert
    expect(rowsOf(feed)).toStrictEqual(rowsOf(page).slice(0, SHEET_ROWS));
    expect(feed.kind === 'sections' && feed.sections.map((s) => s.group)).toStrictEqual(['today', 'thisWeek']);
    expect(hasMore).toBe(true);
    expect(moreCount).toBe(rowsOf(page).length - SHEET_ROWS);
  });

  it('keeps a leading empty line and needs no 더보기 when everything fits', () => {
    // Arrange
    const page = toThisWeekFeed(QUIET.items, 'hssc', QUIET.now);

    // Act
    const { feed, hasMore } = toSheetFeed(page);

    // Assert
    expect(feed.kind === 'sections' && feed.sections[0].emptyLine).toBe('today');
    expect(rowsOf(feed)).toHaveLength(5);
    expect(hasMore).toBe(false);
    expect(toSheetFeed(page).moreCount).toBe(0);
  });
});

describe('toBuildingCounts: a building’s count is the page’s rows that list it (D8)', () => {
  it('counts every group, a row with +N once per building it lists', () => {
    // Arrange
    const page = toThisWeekFeed(BUSY.items, 'hssc', BUSY.now);

    // Act
    const counts = toBuildingCounts(page);

    // Assert
    const rows = rowsOf(page);
    for (const [id, count] of counts) {
      expect(rows.filter((r) => r.buildingIds.includes(Number(id)))).toHaveLength(count);
    }
    expect(Object.fromEntries(counts)).toStrictEqual({ '12': 5, '9': 4, '11': 2, '13': 1, '5': 1, '2': 1, '72': 1 });
  });

  it('is empty for an empty feed', () => {
    // Act & Assert
    expect(toBuildingCounts({ kind: 'empty' }).size).toBe(0);
  });
});

describe('toNextMonday', () => {
  it.each([
    ['a Monday morning', '2026-10-26T09:00:00', '2026-11-02T00:00:00'],
    ['a Sunday night', '2026-11-01T23:59:00', '2026-11-02T00:00:00'],
    ['Monday at midnight', '2026-11-02T00:00:00', '2026-11-09T00:00:00'],
  ])('%s', (_, now, monday) => {
    // Act & Assert
    expect(toNextMonday(at(now))).toBe(at(monday));
  });
});

describe('toSectionTexts and toRowText: the words a view draws', () => {
  it('labels each section, carries its empty line, and tones the qualifier', () => {
    // Arrange
    const feed = toThisWeekFeed(QUIET.items, 'hssc', QUIET.now);

    // Act
    const sections = toSectionTexts(feed, t, tpl);

    // Assert
    expect(sections.map((s) => [s.label, s.emptyLine, s.rows.length])).toStrictEqual([
      ['오늘', '오늘은 잡힌 일정이 없어요', 0],
      ['이번 주 · ~10/25(일)', null, 3],
      ['다음 주 · 10/26(월)~', null, 2],
    ]);
    expect(sections[1].rows[1].qualifier).toStrictEqual({ text: '참가확인증 발급', tone: 'benefit' });
    expect(toSectionTexts({ kind: 'empty' }, t, tpl)).toStrictEqual([]);
  });

  it('moves a room onto the place line beside its building, and keeps every other qualifier on line 2', () => {
    // Arrange
    const rows = rowsOf(toThisWeekFeed(BUSY.items, 'hssc', BUSY.now));

    // Act
    const words = rows.map((row) => [row.qualifier?.kind ?? null, toRowText(row, t, tpl)] as const);

    // Assert
    for (const [kind, text] of words) {
      if (kind === 'room') expect(text.qualifier).toBeNull();
      else if (kind !== null) expect(text.qualifier).not.toBeNull();
    }
    expect(words.filter(([kind]) => kind === 'room').map(([, text]) => text.place)).toStrictEqual([
      '수선관 사회과학연구원 컨퍼런스 룸',
      '국제관 첨단강의실',
    ]);
  });

  // Line 2's line-break rule: the view keeps each unit whole and moves the
  // qualifier under the date when both do not fit, joining them with ` · `.
  // That holds only while no unit carries the separator itself.
  it.each([
    ['10/26', 'hssc'],
    ['10/26', 'nsc'],
    ['10/19', 'hssc'],
    ['10/19', 'nsc'],
  ] as const)('keeps the separator between line 2’s units, never inside one (%s %s)', (week, campus) => {
    // Arrange
    const feed = week === '10/26' ? BUSY : QUIET;

    // Act
    const rows = rowsOf(toThisWeekFeed(feed.items, campus, feed.now)).map((row) => toRowText(row, t, tpl));

    // Assert
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.when).not.toContain(' · ');
      expect(row.qualifier?.text ?? '').not.toContain(' · ');
      expect(row.place).not.toContain(' · ');
    }
  });

  it('keeps a deadline, its day and its hour in one unit', () => {
    // Arrange
    const rows = rowsOf(toThisWeekFeed(BUSY.items, 'hssc', BUSY.now)).map((row) => toRowText(row, t, tpl));

    // Act
    const self = rows.find((r) => r.row.title === '자기이해 집단상담');

    // Assert
    expect(self?.when).toBe('10/28(수)부터 11/25(수)까지');
    expect(self?.qualifier).toStrictEqual({ text: '오늘 17시 신청 마감', tone: 'urgent' });
  });

  it('draws a deadline today or tomorrow red, and a later one plain', () => {
    // Arrange
    const rows = rowsOf(toThisWeekFeed(BUSY.items, 'hssc', BUSY.now)).map((row) => toRowText(row, t, tpl));

    // Act
    const tones = rows.flatMap((r) => (r.qualifier && r.qualifier.text.includes('신청 마감') ? [[r.qualifier.text, r.qualifier.tone]] : []));

    // Assert
    expect(tones).toStrictEqual([
      ['오늘 17시 신청 마감', 'urgent'],
      ['오늘 10시 신청 마감', 'urgent'],
      ['11/3(화) 신청 마감', 'plain'],
    ]);
  });
});

describe('a row’s title: 20 characters, 14 behind a token (D5)', () => {
  it('caps a title behind a token at 14 and leaves one without at 20', () => {
    // Arrange
    const title = '교환학생 설명회·Mobility Fair';
    const closed = item({ id: 'a', shortTitle: title, signUp: { status: 'dated', windows: [{ startAt: null, endAt: at('2026-10-25T18:00:00') }] } });
    const open = item({ id: 'b', articleNo: 2, shortTitle: title });

    // Act
    const rows = rowsOf(toThisWeekFeed([closed, open], 'hssc', NOW));

    // Assert
    expect(Object.fromEntries(rows.map((r) => [r.item.id, [r.token, r.title]]))).toStrictEqual({
      a: ['signUpClosed', '교환학생 설명회·Mobility…'],
      b: [null, '교환학생 설명회·Mobility Fair'],
    });
  });
});

describe('the thisWeekSheet gate', () => {
  it('fills the map tab root sheet with the feed, under its own name, where the gate is open', () => {
    // Act
    const sheet = mapRootSheetOf(true);
    // Assert
    expect(sheet).toStrictEqual({ body: 'feed', label: 'thisWeek.a11y.sheet' });
  });

  it('leaves the same sheet empty, under the plain campus name, where it is closed', () => {
    // Act
    const sheet = mapRootSheetOf(false);
    // Assert: no body and no fallback, and no screen reader names the feed.
    expect(sheet).toStrictEqual({ body: null, label: 'map.sheet.a11y.root' });
  });
});
