/**
 * WHY: the queryFn must throw, never return the fallback: a returned one is a success that replaces
 * good data for the whole staleTime, while a throw keeps the last good data and refetches on mount.
 */
export function dataOrFallback<T>(
  query: { data: T | undefined; isError: boolean },
  fallback: T,
): T | undefined {
  if (query.data !== undefined) return query.data;
  return query.isError ? fallback : undefined;
}
