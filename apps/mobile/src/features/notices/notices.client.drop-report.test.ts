/**
 * A dropped list item is reported under the list it came from. The drop
 * reporter keeps one breadcrumb per name per process, so the single-source and
 * the multi-source lists need names of their own, or a drop in one would hide
 * every later drop in the other. Only the transport is a double.
 */
import { describe, expect, it, vi } from 'vitest';
import { setDropReporter } from '@skkuverse/shared';
import { multiSourceNoticeListQueryOptions, noticeListQueryOptions } from './notices.client';

const PAGE = { notices: [null, { sourceId: 'cse', articleNo: 1, title: 'kept' }], nextCursor: null, hasMore: false };

vi.mock('@skkuverse/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@skkuverse/shared')>();
  return {
    ...actual,
    safeGet: (_url: string, parse: (envelope: unknown) => unknown) =>
      Promise.resolve({ ok: true, data: parse({ data: PAGE }) }),
  };
});

describe('dropped notice reports', () => {
  it('names the single-source and the multi-source list apart', async () => {
    // Arrange
    const where: string[] = [];
    setDropReporter((name) => where.push(name));
    const single = noticeListQueryOptions({ sourceId: 'cse' });
    const multi = multiSourceNoticeListQueryOptions({ sourceIds: ['a', 'b'] });

    // Act
    await single.queryFn!({ pageParam: null } as never);
    await multi.queryFn!({ pageParam: null } as never);

    // Assert
    expect(where).toStrictEqual(['notices.page', 'notices.multiPage']);
  });
});
