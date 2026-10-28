import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AxiosError,
  create,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_TIMEOUT_MS } from '@skkuverse/shared';
import { attachRetryInterceptor } from '../../../../../packages/shared/src/api/interceptors/retry';
import productionKo from './overview/__fixtures__/overview-ko.json';
import { fetchNoticeOverview } from './notices.client';

// The real client module reads expo-constants; swap in an instance built here
// with the app's own retry interceptor, so "no retry" is tested against the
// interceptor that would otherwise retry (vi.mock is hoisted).
const holder = vi.hoisted(() => ({ client: null as AxiosInstance | null }));
vi.mock('../../../../../packages/shared/src/api/client', () => ({
  getApiClient: () => holder.client,
}));

type Reply = 'timeout' | 503 | 429 | 'ok' | 'garbled';

interface Sent {
  url: string | undefined;
  params: unknown;
  timeout: number | undefined;
}

function recordingClient(replies: Reply[]): Sent[] {
  const sent: Sent[] = [];
  const client = create({
    timeout: API_TIMEOUT_MS.write,
    adapter: async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      sent.push({ url: config.url, params: config.params, timeout: config.timeout });
      const reply = replies[sent.length - 1] ?? 'timeout';
      const response = (status: number, data: unknown): AxiosResponse => ({
        data,
        status,
        statusText: String(status),
        headers: {},
        config,
      });
      if (reply === 'timeout') throw new AxiosError('timeout', 'ECONNABORTED', config);
      if (reply === 503 || reply === 429) {
        const body = { error: { code: reply === 429 ? 'RATE_LIMIT' : 'UNAVAILABLE', message: 'x' } };
        throw new AxiosError('status', 'ERR_BAD_RESPONSE', config, undefined, response(reply, body));
      }
      if (reply === 'garbled') {
        return response(200, { meta: { lang: 'ko' }, data: { overview: { lead: null, points: [] } } });
      }
      return response(200, productionKo);
    },
  });
  attachRetryInterceptor(client);
  holder.client = client;
  return sent;
}

async function settle<T>(request: Promise<T>): Promise<T> {
  const settled = request.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const outcome = await settled;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  holder.client = null;
});

describe('fetchNoticeOverview', () => {
  it('asks once, with the overview timeout, the trimmed query and sorted source ids', async () => {
    const sent = recordingClient(['ok']);
    const r = await settle(fetchNoticeOverview('  장학금 신청 ', ['skku-notice06', 'skku-main']));
    expect(r.overview).not.toBeNull();
    expect(sent).toEqual([
      {
        url: '/notices/overview',
        params: { q: '장학금 신청', sourceIds: 'skku-main,skku-notice06' },
        timeout: 25_000,
      },
    ]);
  });

  it.each([
    ['a timeout', 'timeout' as const],
    ['a 503', 503 as const],
  ])('never retries %s, which the shared interceptor would', async (_label, reply) => {
    const sent = recordingClient([reply, 'ok']);
    await expect(settle(fetchNoticeOverview('장학금', ['skku-main']))).rejects.toMatchObject({
      type: reply === 'timeout' ? 'network' : 'server',
    });
    expect(sent).toHaveLength(1);
  });

  it('throws a 429 as a server failure with its status', async () => {
    recordingClient([429]);
    await expect(settle(fetchNoticeOverview('장학금', ['skku-main']))).rejects.toMatchObject({
      type: 'server',
      statusCode: 429,
      errorCode: 'RATE_LIMIT',
    });
  });

  it('throws an answer the parser rejects as a parse failure', async () => {
    recordingClient(['garbled']);
    await expect(settle(fetchNoticeOverview('장학금', ['skku-main']))).rejects.toMatchObject({
      type: 'parse',
    });
  });
});
