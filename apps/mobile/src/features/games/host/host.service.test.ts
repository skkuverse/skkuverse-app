/**
 * A final result goes on the board through the `submitScore` callable: after
 * its run's stamp, under the validator the page is scored by, with the rank
 * the server returns. Each of
 * the function's answers lands on one of the submission states. Only the
 * Firebase SDKs are doubles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logHandledError } from '@/platform/crashlytics';
import { runStamped, startRun } from './host.repository';
import { buildEntry, initialSession, sessionReducer, type SessionState } from './host.rules';
import { SUBMIT_TIMEOUT_MS, claimRunOver, submitResult } from './host.service';

const sdk = vi.hoisted(() => {
  let next = 0;
  return {
    calls: [] as { name: string; data: unknown }[],
    startRun: vi.fn<(data: unknown) => Promise<unknown>>(),
    submitScore: vi.fn<(data: unknown) => Promise<unknown>>(),
    claimRun: vi.fn<(data: unknown) => Promise<unknown>>(),
    getCountFromServer: vi.fn(),
    setDoc: vi.fn(),
    autoId: () => `run${++next}`,
  };
});

vi.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
vi.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  doc: () => ({ id: sdk.autoId() }),
  getCountFromServer: sdk.getCountFromServer,
  setDoc: sdk.setDoc,
}));
vi.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fns: unknown, name: string) => (data: unknown) => {
    sdk.calls.push({ name, data });
    return name === 'startRun' ? sdk.startRun(data) : name === 'claimRun' ? sdk.claimRun(data) : sdk.submitScore(data);
  },
}));
vi.mock('@/platform/crashlytics', () => ({ logHandledError: vi.fn() }));

const httpsError = (code: string) => Object.assign(new Error(code), { code });
const flush = () => new Promise((r) => setTimeout(r, 0));

const over = { score: 850, ticks: 3600, hit: 'bus', revives: 1, revivesLeft: 0 };
const entryFor = (runId: string) =>
  buildEntry({ uid: 'g1', runId, over, profile: { campus: 'hssc', nickname: '파도왕' }, emailPrefix: 'tes' });

/** A final wave-run crash on run `runId`, submitting. */
function submitting(runId: string): SessionState {
  let s = initialSession();
  s = sessionReducer(s, { type: 'page', message: { type: 'game:ready' } });
  s = sessionReducer(s, { type: 'runArmed', run: { id: runId, uid: 'g1' } });
  s = sessionReducer(s, { type: 'page', message: { type: 'game:phase', phase: 'running' } });
  s = sessionReducer(s, { type: 'page', message: { type: 'game:over', ...over } });
  return sessionReducer(s, { type: 'submitStart', runId });
}

beforeEach(() => {
  sdk.calls.length = 0;
  sdk.startRun.mockReset().mockResolvedValue({ data: { ok: true } });
  sdk.submitScore.mockReset();
  sdk.getCountFromServer.mockReset();
  sdk.setDoc.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('submitResult', () => {
  it('waits for the run\'s stamp, then submits the entry under the validator', async () => {
    // Arrange: the stamp has not answered yet.
    let stamp!: (v: unknown) => void;
    sdk.startRun.mockReturnValueOnce(new Promise((r) => (stamp = r)));
    sdk.submitScore.mockResolvedValueOnce({ data: { rank: 3 } });
    const runId = startRun('g1', 'wave-run', vi.fn());

    // Act
    const result = submitResult({ gameId: 'wave-run', entry: entryFor(runId), validator: 'wave-run@1' });
    await flush();
    const before = sdk.calls.map((c) => c.name);
    stamp({ data: { ok: true } });

    // Assert
    expect(before).toStrictEqual(['startRun']);
    await expect(result).resolves.toStrictEqual({ kind: 'submitted', rank: 3 });
    expect(sdk.calls.map((c) => c.name)).toStrictEqual(['startRun', 'submitScore']);
    expect(sdk.submitScore).toHaveBeenCalledWith({
      gameId: 'wave-run',
      runId,
      score: 850,
      revives: 1,
      validator: 'wave-run@1',
      nickname: '파도왕',
      campus: 'hssc',
      emailPrefix: 'tes',
    });
  });

  it('a written entry is shown at the rank the server returned, with no client write or count after it', async () => {
    // Arrange
    const runId = startRun('g1', 'wave-run', vi.fn());
    await runStamped(runId);
    sdk.submitScore.mockResolvedValueOnce({ data: { rank: 7 } });

    // Act
    const result = await submitResult({ gameId: 'wave-run', entry: entryFor(runId), validator: 'wave-run@1' });
    const s =
      result.kind === 'submitted' ? sessionReducer(submitting(runId), { type: 'submitted', runId, rank: result.rank }) : null;

    // Assert
    expect(s?.submission).toStrictEqual({ status: 'submitted', rank: 7 });
    expect(sdk.getCountFromServer).not.toHaveBeenCalled();
    expect(sdk.setDoc).not.toHaveBeenCalled();
  });

  it('a rank the server could not count is null', async () => {
    // Arrange
    const runId = startRun('g1', 'wave-run', vi.fn());
    sdk.submitScore.mockResolvedValueOnce({ data: { rank: null } });

    // Act + Assert
    await expect(submitResult({ gameId: 'wave-run', entry: entryFor(runId), validator: 'wave-run@1' })).resolves.toStrictEqual({
      kind: 'submitted',
      rank: null,
    });
  });

  it.each([
    ['failed-precondition', 'notImproved'],
    ['permission-denied', 'rejected'],
    ['invalid-argument', 'rejected'],
    ['unavailable', 'network'],
    ['deadline-exceeded', 'network'],
    ['internal', 'network'],
  ] as const)('%s is %s', async (code, kind) => {
    // Arrange
    const runId = startRun('g1', 'subway-typing', vi.fn());
    sdk.submitScore.mockRejectedValueOnce(httpsError(code));

    // Act
    const result = await submitResult({ gameId: 'subway-typing', entry: entryFor(runId), validator: 'subway-typing@1' });

    // Assert
    expect(result).toStrictEqual({ kind });
    expect(sdk.submitScore).toHaveBeenCalledTimes(1);
  });

  it('a server that does not answer in time is a network failure', async () => {
    // Arrange
    vi.useFakeTimers();
    const runId = startRun('g1', 'wave-run', vi.fn());
    sdk.submitScore.mockReturnValueOnce(new Promise(() => {}));

    // Act
    const result = submitResult({ gameId: 'wave-run', entry: entryFor(runId), validator: 'wave-run@1' });
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS - 1);
    let settled = false;
    void result.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    const early = settled;
    await vi.advanceTimersByTimeAsync(1);

    // Assert
    expect(early).toBe(false);
    await expect(result).resolves.toStrictEqual({ kind: 'network' });
  });

  it('a retry after a timed-out call that committed lands on submitted, sending the same result again', async () => {
    // Arrange: the first call commits on the server, but its answer comes
    // back after the device has given up; the server answers the same
    // payload again as written (submitScore is idempotent per run).
    vi.useFakeTimers();
    const runId = startRun('g1', 'wave-run', vi.fn());
    sdk.submitScore
      .mockReturnValueOnce(new Promise((r) => setTimeout(() => r({ data: { rank: 4 } }), SUBMIT_TIMEOUT_MS + 1_000)))
      .mockResolvedValueOnce({ data: { rank: 4 } });
    const entry = entryFor(runId);

    // Act: the first attempt times out.
    const first = submitResult({ gameId: 'wave-run', entry, validator: 'wave-run@1' });
    await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
    const firstResult = await first;
    let s = sessionReducer(submitting(runId), { type: 'submitFailed', runId, reason: 'network' });
    // The player taps retry.
    s = sessionReducer(s, { type: 'submitRetry', runId });
    const retrying = s.submission;
    const second = await submitResult({ gameId: 'wave-run', entry, validator: 'wave-run@1' });
    if (second.kind === 'submitted') s = sessionReducer(s, { type: 'submitted', runId, rank: second.rank });

    // Assert
    expect(firstResult).toStrictEqual({ kind: 'network' });
    expect(retrying).toStrictEqual({ status: 'retrying' });
    expect(second).toStrictEqual({ kind: 'submitted', rank: 4 });
    expect(s.submission).toStrictEqual({ status: 'submitted', rank: 4 });
    const sent = sdk.calls.filter((c) => c.name === 'submitScore').map((c) => c.data);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toStrictEqual(sent[0]);
  });

  it('a result with no validator is refused without a call', async () => {
    // Act
    const result = await submitResult({ gameId: 'wave-run', entry: entryFor('r1'), validator: null });

    // Assert
    expect(result).toStrictEqual({ kind: 'rejected' });
    expect(sdk.submitScore).not.toHaveBeenCalled();
  });
});

describe('claimRunOver', () => {
  beforeEach(() => {
    sdk.claimRun.mockReset();
    vi.mocked(logHandledError).mockClear();
  });

  it('waits for the run\'s stamp, then claims it with the anonymous token', async () => {
    // Arrange: the stamp has not answered yet.
    let stamp!: (v: unknown) => void;
    sdk.startRun.mockReturnValueOnce(new Promise((r) => (stamp = r)));
    sdk.claimRun.mockResolvedValueOnce({ data: { ok: true } });
    const runId = startRun('anon1', 'wave-run', vi.fn());

    // Act
    const claimed = claimRunOver('anon-token', runId);
    await flush();
    const before = sdk.calls.map((c) => c.name);
    stamp({ data: { ok: true } });

    // Assert
    expect(before).toStrictEqual(['startRun']);
    await expect(claimed).resolves.toBe(true);
    expect(sdk.calls.map((c) => c.name)).toStrictEqual(['startRun', 'claimRun']);
    expect(sdk.claimRun).toHaveBeenCalledWith({ anonIdToken: 'anon-token', runId });
  });

  it('a claim that fails once is sent again', async () => {
    // Arrange
    const runId = startRun('anon1', 'wave-run', vi.fn());
    sdk.claimRun.mockRejectedValueOnce(httpsError('unavailable')).mockResolvedValueOnce({ data: { ok: true } });

    // Act
    const claimed = await claimRunOver('anon-token', runId);

    // Assert
    expect(claimed).toBe(true);
    expect(sdk.claimRun).toHaveBeenCalledTimes(2);
    expect(logHandledError).not.toHaveBeenCalled();
  });

  it('a claim that fails twice resolves false and is reported, never rejecting', async () => {
    // Arrange
    const runId = startRun('anon1', 'wave-run', vi.fn());
    const refusal = httpsError('permission-denied');
    sdk.claimRun.mockRejectedValueOnce(httpsError('unavailable')).mockRejectedValueOnce(refusal);

    // Act
    const claimed = await claimRunOver('anon-token', runId);

    // Assert
    expect(claimed).toBe(false);
    expect(sdk.claimRun).toHaveBeenCalledTimes(2);
    expect(logHandledError).toHaveBeenCalledWith('games/claim-run', refusal);
  });
});
