import type { AxiosError, AxiosInstance } from 'axios';
import axiosRetry, { exponentialDelay, isNetworkError } from 'axios-retry';

// WHY: one retry, only where a second attempt can help. Never 429 (slow down), 500 (fails the same
// way) or other 4xx; never a POST on a status, since it may have been applied. 401 is auth's job.
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);
const RETRY_BASE_DELAY_MS = 500;

function isTimeout(error: AxiosError): boolean {
  return !error.response && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT');
}

export function shouldRetryRequest(error: AxiosError): boolean {
  if (isNetworkError(error)) return true;

  const method = error.config?.method?.toLowerCase();
  if (method === undefined || !IDEMPOTENT_METHODS.has(method)) return false;

  if (isTimeout(error)) return true;
  const status = error.response?.status;
  return status !== undefined && RETRYABLE_STATUSES.has(status);
}

/**
 * QUIRK(axios-retry): `exponentialDelay` honours `Retry-After` and adds up to 20% jitter, so a burst
 * of failures does not come back as a burst of retries.
 */
export function retryDelayMs(retryCount: number, error: AxiosError): number {
  return exponentialDelay(retryCount, error, RETRY_BASE_DELAY_MS);
}

/**
 * EVIDENCE: the app's only retry layer: with React Query's retry also on, a failing query sent 6
 * requests on fixed delays, and devices that failed together retried together. Never add a second.
 */
export function attachRetryInterceptor(client: AxiosInstance): void {
  axiosRetry(client, {
    retries: 1,
    retryCondition: shouldRetryRequest,
    retryDelay: retryDelayMs,
    shouldResetTimeout: true,
  });
}
