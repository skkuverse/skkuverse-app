import type { AxiosResponse } from 'axios';

export function observabilityInterceptor(
  response: AxiosResponse,
): AxiosResponse {
  if (__DEV__) {
    const requestId = response.headers['x-request-id'];
    const responseTime = response.headers['x-response-time'];
    const path = response.config.url;

    if (requestId || responseTime) {
      console.debug(`[api] ${requestId ?? ''} ${path} ${responseTime ?? ''}`);
    }
  }
  return response;
}
