import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrFallback } from '@skkuverse/shared';
import { CAMPUS_SECTIONS_KEY, campusSectionsQueryOptions } from './campus-sheet.client';
import { DEFAULT_CAMPUS_SECTIONS } from './campus-sheet.constants';

/**
 * WHY: the defaults are empty, so a caller cannot tell a dead API from an empty feed; one that must should
 * read `query.isFetched` rather than reintroduce a non-empty fallback.
 */
export function useCampusSections() {
  const queryClient = useQueryClient();

  const query = useQuery(campusSectionsQueryOptions());

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: CAMPUS_SECTIONS_KEY });

  return {
    ...query,
    data: dataOrFallback(query, DEFAULT_CAMPUS_SECTIONS),
    refresh,
  };
}
