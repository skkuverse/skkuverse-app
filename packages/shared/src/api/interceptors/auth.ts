import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * WHY: the app injects the token getter, so this package never imports @react-native-firebase/auth
 * and runs in tests.
 */
type AuthTokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

let tokenProvider: AuthTokenProvider | null = null;

export function setAuthTokenProvider(provider: AuthTokenProvider): void {
  tokenProvider = provider;
}

async function getToken(forceRefresh = false): Promise<string | null> {
  if (!tokenProvider) return null;
  try {
    return await tokenProvider(forceRefresh);
  } catch {
    return null;
  }
}

// WHY: concurrent 401s await one refresh instead of each forcing their own.
let refreshPromise: Promise<string | null> | null = null;

const AUTH_RETRIED = '__authRetried';

export function attachAuthInterceptor(client: AxiosInstance): void {
  client.interceptors.request.use(async (config) => {
    const token = await getToken(false);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(undefined, async (error) => {
    const originalConfig = error.config as
      | (InternalAxiosRequestConfig & { [AUTH_RETRIED]?: boolean })
      | undefined;

    if (
      error.response?.status !== 401 ||
      !originalConfig ||
      originalConfig[AUTH_RETRIED]
    ) {
      return Promise.reject(error);
    }

    originalConfig[AUTH_RETRIED] = true;

    if (!refreshPromise) {
      refreshPromise = getToken(true).finally(() => {
        refreshPromise = null;
      });
    }

    const freshToken = await refreshPromise;
    if (!freshToken) {
      return Promise.reject(error);
    }

    originalConfig.headers.Authorization = `Bearer ${freshToken}`;
    return client.request(originalConfig);
  });
}
