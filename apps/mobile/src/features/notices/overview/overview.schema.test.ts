import { describe, it, expect } from 'vitest';
import type { ApiEnvelope } from '@skkuverse/shared';
import { parseNoticeOverview } from './overview.schema';
// Production answers to "장학금 신청 언제까지야?" over skku-main, captured
// 2026-10-09 with Accept-Language ko and en.
import productionKo from './__fixtures__/overview-ko.json';
import productionEn from './__fixtures__/overview-en.json';
import type { OverviewDto } from './overview.types';

function envelope(meta: Record<string, unknown>, data: unknown): ApiEnvelope<unknown> {
  return { meta, data } as unknown as ApiEnvelope<unknown>;
}

// skkuverse-server openspec design.md, the ROTC production sample.
const ROTC = {
  lead: { text: 'ROTC 지원은 10월 13일 24:00까지 인터넷으로 접수할 수 있어요.', cites: [1] },
  points: [
    { text: '지원 대상은 1·2학년 재학생이에요.', cites: [1] },
    { text: '지원서 접수는 acq.armyofficer.mil.kr에서 진행돼요.', cites: [1] },
  ],
  sources: [
    {
      n: 1,
      sourceId: 'skku-main',
      articleNo: 140112,
      title: '2027년도 ROTC 후보생 모집 안내',
      date: '2026-09-24',
      contentMissing: false,
    },
  ],
  lang: 'ko',
  generatedAt: '2026-10-06T08:00:02.512Z',
};

describe('parseNoticeOverview', () => {
  it('parses an answer', () => {
    const r = parseNoticeOverview(envelope({ lang: 'ko', cached: false }, { overview: ROTC }));
    expect(r.cached).toBe(false);
    expect(r.reason).toBeNull();
    expect(r.overview?.lead?.cites).toEqual([1]);
    expect(r.overview?.points).toHaveLength(2);
    expect(r.overview?.sources[0]).toEqual(ROTC.sources[0]);
    expect(r.overview?.lang).toBe('ko');
  });

  it.each(['no_results', 'no_answer', 'unavailable'] as const)('carries reason %s', (reason) => {
    const r = parseNoticeOverview(envelope({ lang: 'ko', cached: false, reason }, { overview: null }));
    expect(r).toEqual({ overview: null, cached: false, reason });
  });

  it('keeps cached on a cached no_answer', () => {
    const r = parseNoticeOverview(
      envelope({ lang: 'ko', cached: true, reason: 'no_answer' }, { overview: null }),
    );
    expect(r.cached).toBe(true);
  });

  it('reads an unknown reason as unavailable', () => {
    const r = parseNoticeOverview(envelope({ reason: 'later' }, { overview: null }));
    expect(r.reason).toBe('unavailable');
  });

  it('accepts a numeric-string articleNo', () => {
    const src = { ...ROTC.sources[0], articleNo: '140112' };
    const r = parseNoticeOverview(envelope({}, { overview: { ...ROTC, sources: [src] } }));
    expect(r.overview?.sources[0].articleNo).toBe(140112);
  });

  it('keeps a null lead null', () => {
    const r = parseNoticeOverview(envelope({}, { overview: { ...ROTC, lead: null } }));
    expect(r.overview?.lead).toBeNull();
    expect(r.overview?.points).toHaveLength(2);
  });

  it('reads any non-en answer language as ko', () => {
    const r = parseNoticeOverview(envelope({}, { overview: { ...ROTC, lang: 'zh' } }));
    expect(r.overview?.lang).toBe('ko');
  });

  it.each([
    ['a missing data object', envelope({}, null)],
    ['points that are not an array', envelope({}, { overview: { ...ROTC, points: null } })],
    ['an empty cites', envelope({}, { overview: { ...ROTC, lead: { text: 'x', cites: [] } } })],
    ['a cite naming no source', envelope({}, { overview: { ...ROTC, lead: { text: 'x', cites: [2] } } })],
    ['a non-numeric articleNo', envelope({}, {
      overview: { ...ROTC, sources: [{ ...ROTC.sources[0], articleNo: 'abc' }] },
    })],
    ['no lead and no points', envelope({}, { overview: { ...ROTC, lead: null, points: [] } })],
  ])('throws on %s', (_label, raw) => {
    expect(() => parseNoticeOverview(raw)).toThrow();
  });
});

describe('parseNoticeOverview — the edges of the wire', () => {
  const source = ROTC.sources[0];
  const withSource = (patch: Record<string, unknown>) =>
    envelope({}, { overview: { ...ROTC, sources: [{ ...source, ...patch }] } });

  it('reads a missing overview as no answer, and takes the reason from meta', () => {
    // Act
    const r = parseNoticeOverview(envelope({ cached: true, reason: 'no_results' }, {}));

    // Assert
    expect(r).toEqual({ overview: null, cached: true, reason: 'no_results' });
  });

  it('ignores the reason when an answer is present', () => {
    // Act
    const r = parseNoticeOverview(envelope({ reason: 'no_answer' }, { overview: ROTC }));

    // Assert
    expect(r.reason).toBeNull();
  });

  it.each([undefined, 1, null, 'NO_ANSWER'])('reads the reason %j as unavailable', (reason) => {
    // Act
    const r = parseNoticeOverview(envelope({ reason }, { overview: null }));

    // Assert
    expect(r.reason).toBe('unavailable');
  });

  it.each(['true', 1, null, undefined])('reads cached %j as false', (cached) => {
    // Act
    const r = parseNoticeOverview(envelope({ cached }, { overview: null }));

    // Assert
    expect(r.cached).toBe(false);
  });

  it('keeps only the fields it knows, and reads a missing lead or language as none and ko', () => {
    // Arrange
    const { lead: _lead, lang: _lang, ...rest } = ROTC;
    const overview = {
      ...rest,
      points: [{ ...ROTC.points[0], extra: 1 }],
      sources: [{ ...source, extra: 1 }],
      extra: 1,
    };

    // Act
    const r = parseNoticeOverview(envelope({}, { overview }));

    // Assert
    expect(r.overview).toStrictEqual({
      lead: null,
      points: [ROTC.points[0]],
      sources: [source],
      lang: 'ko',
      generatedAt: ROTC.generatedAt,
    });
  });

  it('orders the sources by their number', () => {
    // Arrange
    const second = { ...source, n: 2, articleNo: 1 };
    const overview = { ...ROTC, points: [{ text: 'b', cites: [2, 1] }], sources: [second, source] };

    // Act
    const r = parseNoticeOverview(envelope({}, { overview }));

    // Assert
    expect(r.overview?.sources.map((s) => s.n)).toEqual([1, 2]);
  });

  it('keeps the first ten characters of a source date', () => {
    // Act
    const r = parseNoticeOverview(withSource({ date: '2026-09-24T09:00:00+09:00' }));

    // Assert
    expect(r.overview?.sources[0].date).toBe('2026-09-24');
  });

  it.each([true, false, 'true', 1, undefined])('reads contentMissing %j as true only when it is true', (contentMissing) => {
    // Act
    const r = parseNoticeOverview(withSource({ contentMissing }));

    // Assert
    expect(r.overview?.sources[0].contentMissing).toBe(contentMissing === true);
  });

  it.each([
    [140112, 140112],
    ['0012', 12],
    [0, 0],
    [-5, -5],
    [1e20, 1e20],
  ])('reads the articleNo %j as %j', (articleNo, expected) => {
    // Act
    const r = parseNoticeOverview(withSource({ articleNo }));

    // Assert
    expect(r.overview?.sources[0].articleNo).toBe(expected);
  });

  it.each([
    ['a meta that is not an object', envelope(null as never, { overview: ROTC })],
    ['a meta that is a list', envelope([] as never, { overview: ROTC })],
    ['a data that is a list', envelope({}, [])],
    ['an overview that is not an object', envelope({}, { overview: 'x' })],
    ['an overview that is false', envelope({}, { overview: false })],
    ['an overview that is a list', envelope({}, { overview: [] })],
    ['a lead that is not a sentence', envelope({}, { overview: { ...ROTC, lead: 'x' } })],
    ['a sentence without text', envelope({}, { overview: { ...ROTC, lead: { cites: [1] } } })],
    ['cites that are not a list', envelope({}, { overview: { ...ROTC, lead: { text: 'x', cites: 1 } } })],
    ['a fractional cite', envelope({}, { overview: { ...ROTC, lead: { text: 'x', cites: [1, 1.5] } } })],
    ['a string cite', envelope({}, { overview: { ...ROTC, lead: { text: 'x', cites: ['1'] } } })],
    ['sources that are not a list', envelope({}, { overview: { ...ROTC, sources: {} } })],
    ['a missing generatedAt', envelope({}, { overview: { ...ROTC, generatedAt: undefined } })],
    ['a string source number', withSource({ n: '1' })],
    ['a missing sourceId', withSource({ sourceId: undefined })],
    ['a numeric title', withSource({ title: 1 })],
    ['a missing date', withSource({ date: undefined })],
    ['a fractional articleNo', withSource({ articleNo: 1.5 })],
    ['a signed articleNo string', withSource({ articleNo: '-5' })],
    ['a padded articleNo string', withSource({ articleNo: ' 12' })],
    ['an empty articleNo string', withSource({ articleNo: '' })],
  ])('throws on %s', (_label, raw) => {
    // Act & Assert
    expect(() => parseNoticeOverview(raw)).toThrow();
  });
});

describe('parseNoticeOverview — a malformed part', () => {
  const source = ROTC.sources[0];
  const uncited = { ...source, n: 2, articleNo: 2 };

  it.each([
    ['null', null],
    ['a blank text', { text: '', cites: [1] }],
  ])('drops a point alone: %s', (_label, point) => {
    // Act
    const r = parseNoticeOverview(envelope({}, { overview: { ...ROTC, points: [point, ...ROTC.points] } }));

    // Assert
    expect(r.overview?.points).toStrictEqual(ROTC.points);
  });

  it.each([
    ['null', null],
    ['a blank sourceId', { ...uncited, sourceId: '' }],
    ['a blank title', { ...uncited, title: '' }],
    ['a fractional number', { ...uncited, n: 2.5 }],
  ])('drops an uncited source alone: %s', (_label, extra) => {
    // Act
    const r = parseNoticeOverview(envelope({}, { overview: { ...ROTC, sources: [source, extra] } }));

    // Assert
    expect(r.overview?.sources).toStrictEqual([source]);
  });

  it.each([
    ['a blank lead text', { ...ROTC, lead: { text: '', cites: [1] } }],
    ['a cited source with a blank sourceId', { ...ROTC, sources: [{ ...source, sourceId: '' }] }],
    ['a cited source with a blank title', { ...ROTC, sources: [{ ...source, title: '' }] }],
  ])('throws on %s', (_label, overview) => {
    // Act & Assert
    expect(() => parseNoticeOverview(envelope({}, { overview }))).toThrow();
  });
});

/** The server's citation invariants (skkuverse-server overview.citations.ts). */
function expectContract(dto: OverviewDto) {
  const sentences = [...(dto.lead ? [dto.lead] : []), ...dto.points];
  expect(sentences.length).toBeGreaterThan(0);
  expect(dto.points.length).toBeLessThanOrEqual(5);
  expect(dto.sources.length).toBeLessThanOrEqual(6);

  const ns = dto.sources.map((s) => s.n);
  expect(ns).toEqual(ns.map((_, i) => i + 1));

  const firstSeen: number[] = [];
  for (const s of sentences) {
    expect(s.cites.length).toBeGreaterThan(0);
    expect(new Set(s.cites).size).toBe(s.cites.length);
    for (const c of s.cites) {
      expect(ns).toContain(c);
      if (!firstSeen.includes(c)) firstSeen.push(c);
    }
  }
  // Numbered in the order the reader first meets them, and every source is cited.
  expect(firstSeen).toEqual(ns);
}

describe('production responses', () => {
  it.each([
    ['ko', productionKo],
    ['en', productionEn],
  ])('%s parses and satisfies the server contract', (_lang, raw) => {
    const r = parseNoticeOverview(raw as unknown as ApiEnvelope<unknown>);
    expect(r.reason).toBeNull();
    expect(r.cached).toBe(false);
    expectContract(r.overview!);
    for (const s of r.overview!.sources) {
      expect(Number.isInteger(s.articleNo)).toBe(true);
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('keeps the Korean answer without a lead', () => {
    const o = parseNoticeOverview(productionKo as unknown as ApiEnvelope<unknown>).overview!;
    expect(o.lead).toBeNull();
    expect(o.points.length).toBeGreaterThan(0);
    expect(o.lang).toBe('ko');
  });

  it('reads the English request as an en answer', () => {
    expect(parseNoticeOverview(productionEn as unknown as ApiEnvelope<unknown>).overview!.lang).toBe('en');
  });

  it.each([
    ['overview-ko', productionKo],
    ['overview-en', productionEn],
  ])('%s reads whole', (_name, raw) => {
    // Act & Assert
    expect(parseNoticeOverview(raw as unknown as ApiEnvelope<unknown>)).toMatchSnapshot();
  });
});
