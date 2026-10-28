import type { ConditionalResult } from './types';

export interface ConditionalSnapshot<T> {
  data: T;
  etag: string | null;
}

/**
 * WHY: a 304 keeps the same object. With nothing cached it yields undefined; only a misbehaving cache
 * sends that, since a request with no snapshot carries no ETag.
 */
export function nextSnapshot<T>(
  previous: ConditionalSnapshot<T> | undefined,
  response: ConditionalResult<T>,
): ConditionalSnapshot<T> | undefined {
  if (response.notModified || response.data === null) return previous;
  return { data: response.data, etag: response.etag };
}
