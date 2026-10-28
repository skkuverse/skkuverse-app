/**
 * Run stamps through the `startRun` callable: the id comes back at once, as
 * the session machine needs (GameScreen `arm` dispatches it in the same
 * tick), and `runStamped` is what waits for the call. Only the Firebase SDKs
 * are doubles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runStamped, startRun } from './host.repository';
import { initialSession, sessionReducer, decideSubmit } from './host.rules';

const sdk = vi.hoisted(() => {
  let next = 0;
  return {
    callable: vi.fn<(data: unknown) => Promise<unknown>>(),
    names: [] as string[],
    autoId: () => `auto${++next}`,
  };
});

vi.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
vi.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  doc: () => ({ id: sdk.autoId() }),
}));
vi.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fns: unknown, name: string) => (data: unknown) => {
    sdk.names.push(name);
    return sdk.callable(data);
  },
}));

const httpsError = (code: string) => Object.assign(new Error(code), { code });

function deferred() {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  sdk.callable.mockReset();
  sdk.names.length = 0;
});

describe('startRun', () => {
  it('returns the proposed id before the call answers, and the session arms it in the same tick', async () => {
    // Arrange
    const call = deferred();
    sdk.callable.mockReturnValueOnce(call.promise);
    const onError = vi.fn();

    // Act
    const id = startRun('anon1', 'wave-run', onError);
    const s = sessionReducer(initialSession(), { type: 'runArmed', run: { id, uid: 'anon1' } });

    // Assert
    expect(id).toMatch(/^auto\d+$/);
    expect(s.run).toStrictEqual({ id, uid: 'anon1' });
    expect(sdk.names).toStrictEqual(['startRun']);
    expect(sdk.callable).toHaveBeenCalledWith({ gameId: 'wave-run', runId: id });
    let stamped = false;
    void runStamped(id).then(() => (stamped = true));
    await flush();
    expect(stamped).toBe(false);
    call.resolve({ data: { ok: true } });
    await flush();
    expect(stamped).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('a refused call is reported, and runStamped still resolves', async () => {
    // Arrange
    sdk.callable.mockRejectedValueOnce(httpsError('invalid-argument'));
    const onError = vi.fn();

    // Act
    const id = startRun('u1', 'subway-typing', onError);
    await runStamped(id);
    await flush();

    // Assert
    expect(sdk.callable).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid-argument' }));
  });

  it('a transient failure is tried once more', async () => {
    // Arrange
    sdk.callable.mockRejectedValueOnce(httpsError('unavailable')).mockResolvedValueOnce({ data: { ok: true } });
    const onError = vi.fn();

    // Act
    const id = startRun('u1', 'wave-run', onError);
    await runStamped(id);
    await flush();

    // Assert
    expect(sdk.callable).toHaveBeenCalledTimes(2);
    expect(sdk.callable.mock.calls[1][0]).toStrictEqual({ gameId: 'wave-run', runId: id });
    expect(onError).not.toHaveBeenCalled();
  });

  it('on the second try, an existing run is the first try having landed', async () => {
    // Arrange
    sdk.callable.mockRejectedValueOnce(httpsError('deadline-exceeded')).mockRejectedValueOnce(httpsError('already-exists'));
    const onError = vi.fn();

    // Act
    const id = startRun('u1', 'wave-run', onError);
    await runStamped(id);
    await flush();

    // Assert
    expect(sdk.callable).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('two failures are reported once', async () => {
    // Arrange
    sdk.callable.mockRejectedValueOnce(httpsError('unavailable')).mockRejectedValueOnce(httpsError('unavailable'));
    const onError = vi.fn();

    // Act
    const id = startRun('u1', 'wave-run', onError);
    await runStamped(id);
    await flush();

    // Assert
    expect(sdk.callable).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('an anonymous run is still offered the board through sign-in, stamp answered or not', () => {
    // Arrange: the call has not answered when the run ends.
    sdk.callable.mockReturnValueOnce(new Promise(() => {}));
    const id = startRun('anon1', 'wave-run', vi.fn());
    let s = sessionReducer(initialSession(), { type: 'page', message: { type: 'game:ready' } });
    s = sessionReducer(s, { type: 'runArmed', run: { id, uid: 'anon1' } });
    const decide = (uid: string, isAnonymous: boolean) =>
      decideSubmit({
        uid,
        isAnonymous,
        emailPrefix: isAnonymous ? null : 'tes',
        run: s.run,
        profile: { campus: 'hssc', nickname: '파도왕' },
        score: 420,
        myBest: null,
        better: (a, b) => a > b,
        maxEntry: 99999,
      });

    // Act + Assert: anonymous → sign in; claimed to the new uid → submit.
    expect(decide('anon1', true)).toStrictEqual({ kind: 'signIn' });
    s = sessionReducer(s, { type: 'runArmed', run: { id, uid: 'g1' } });
    expect(decide('g1', false)).toStrictEqual({ kind: 'submit' });
  });
});
