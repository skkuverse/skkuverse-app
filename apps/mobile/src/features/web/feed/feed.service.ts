import { queryClient } from '@skkuverse/shared';
import { miniAppFeedQueryOptions } from '../web.client';
import type { MiniAppFeedEntry } from '../web.types';
import { hasFeedEntry, toFeedPush } from './feed.rules';

// WHY: another server replica may still hold the pre-push feed for up to its 3 s cache TTL.
const RETRY_AFTER_MS = 5_000;

async function refetchMiniAppFeed(miniAppId: string): Promise<MiniAppFeedEntry[] | undefined> {
  const { queryKey } = miniAppFeedQueryOptions(miniAppId);
  await queryClient.invalidateQueries({ queryKey });
  return queryClient.getQueryData(queryKey);
}

/**
 * WHY: home and the feed screen show the entry the banner announces; one more refetch follows if the answer lacks
 * it.
 */
export function refreshMiniAppFeedOnPush(data: Record<string, unknown> | undefined): void {
  const push = toFeedPush(data);
  if (!push) return;
  const { miniAppId, entryId } = push;
  void refetchMiniAppFeed(miniAppId)
    .then((entries) => {
      if (entryId === null || hasFeedEntry(entries, entryId)) return;
      setTimeout(() => void refetchMiniAppFeed(miniAppId), RETRY_AFTER_MS);
    })
    .catch(() => undefined);
}
