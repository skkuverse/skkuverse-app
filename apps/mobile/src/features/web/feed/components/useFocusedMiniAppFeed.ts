import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useQuery } from '@tanstack/react-query';
import { readNow } from '@/platform/clock';
import { miniAppFeedQueryOptions } from '../../web.client';
import { isFeedRefetchDue } from '../feed.rules';

export function useFocusedMiniAppFeed(
  miniAppId: string,
  { refetchMs, refetchOnRefocus }: { refetchMs: number; refetchOnRefocus: boolean },
) {
  const [focused, setFocused] = useState(true);
  const query = useQuery({
    ...miniAppFeedQueryOptions(miniAppId),
    enabled: !!miniAppId,
    refetchInterval: focused ? refetchMs : false,
    refetchIntervalInBackground: false,
  });
  const { refetch, dataUpdatedAt } = query;
  // WHY: the interval restarts on refocus without fetching, so a return from
  // another tab fetches now, unless what is shown is only seconds old.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (refetchOnRefocus && isFeedRefetchDue(dataUpdatedAt, readNow())) void refetch();
      return () => setFocused(false);
    }, [refetchOnRefocus, refetch, dataUpdatedAt]),
  );
  return query;
}
