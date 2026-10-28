import { describe, it, expect } from 'vitest';
import { Failure } from '@skkuverse/shared';
import { overviewOutcome } from './overview.rules';
import type { NoticeOverviewResult, OverviewDto } from './overview.types';

const ANSWER: OverviewDto = {
  lead: { text: 'x', cites: [1] },
  points: [],
  sources: [
    { n: 1, sourceId: 'skku-main', articleNo: 1, title: 't', date: '2026-10-09', contentMissing: false },
  ],
  lang: 'ko',
  generatedAt: '2026-10-09T00:00:00.000Z',
};

describe('overviewOutcome', () => {
  it('is null while nothing has settled', () => {
    expect(overviewOutcome(undefined, null)).toBeNull();
  });

  it('is answer when an overview came back', () => {
    expect(overviewOutcome({ overview: ANSWER, cached: true, reason: null }, null)).toBe('answer');
  });

  it.each(['no_results', 'no_answer', 'unavailable'] as const)('is the reason %s', (reason) => {
    const data: NoticeOverviewResult = { overview: null, cached: false, reason };
    expect(overviewOutcome(data, null)).toBe(reason);
  });

  it.each([
    ['rate_limited', Failure.server(429, 'Too many requests', 'RATE_LIMIT')],
    ['server', Failure.server(500, 'Server error 500')],
    ['network', Failure.network('timeout of 25000ms exceeded')],
    ['parse', Failure.parse('overview: cite 2 names no source')],
    ['cancelled', Failure.cancelled()],
  ] as const)('is %s for its failure', (outcome, failure) => {
    expect(overviewOutcome(undefined, failure)).toBe(outcome);
  });
});
