import { create, type AxiosInstance } from 'axios';
import { ApiConfig } from './config';
import {
  platformInterceptor,
  observabilityInterceptor,
  attachRetryInterceptor,
  attachAuthInterceptor,
} from './interceptors';
import { API_TIMEOUT_MS } from './timeouts';

/**
 * WHY: axios runs request interceptors LIFO, so auth is attached last to run first and set the
 * token before the platform headers.
 */
export function createApiClient(): AxiosInstance {
  const client = create({
    baseURL: ApiConfig.baseUrl,
    // WHY: GETs get the shorter `read` timeout from the safeGet* wrappers; this covers the rest.
    timeout: API_TIMEOUT_MS.write,
  });

  client.interceptors.request.use(platformInterceptor);

  client.interceptors.response.use(observabilityInterceptor);

  attachRetryInterceptor(client);

  attachAuthInterceptor(client);

  return client;
}

let instance: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (!instance) {
    instance = createApiClient();
  }
  return instance;
}

export function resetApiClient(): void {
  instance = null;
}
