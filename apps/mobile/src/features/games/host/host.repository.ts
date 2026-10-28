import { getApp } from '@react-native-firebase/app';
import { collection, doc, getFirestore } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { createMMKV } from 'react-native-mmkv';
import type { GameId } from '../games.constants';
import { isTransientCallError, type EntryFields } from './host.rules';

/** WHY: the client proposes the run id to the `startRun` callable, so a run is armed without waiting for the call. */

const functions = () => getFunctions(getApp(), 'asia-northeast3');

function callStartRun(gameId: GameId, runId: string): Promise<unknown> {
  return httpsCallable<{ gameId: GameId; runId: string }, { ok: true }>(functions(), 'startRun')({ gameId, runId });
}

/**
 * WHY: a second try only when the first may not have reached the function; an existing run then is this device's
 * first try landing, since the id is fresh.
 */
function stamp(gameId: GameId, runId: string): Promise<void> {
  return callStartRun(gameId, runId).then(
    () => undefined,
    (err: unknown) => {
      if (!isTransientCallError(err)) throw err;
      return callStartRun(gameId, runId).then(
        () => undefined,
        (again: unknown) => {
          if ((again as { code?: unknown } | null)?.code === 'already-exists') return;
          throw again;
        },
      );
    },
  );
}

/**
 * WHY: an entry waits for its run's stamp, or one sent right after a short run could overtake the call and be
 * refused for citing no run.
 */
const runWrites = new Map<string, Promise<void>>();

/** WHY: sent before the run begins, so the stamp never postdates the run it belongs to. */
export function startRun(uid: string, gameId: GameId, onError: (e: unknown) => void): string {
  const runId = doc(collection(getFirestore(), 'users', uid, 'gameRuns')).id;
  const written = stamp(gameId, runId);
  runWrites.set(runId, written);
  written.catch((err) => {
    // WHY: a failed stamp is forgotten, so an entry citing it is refused at once instead of every retry awaiting
    // the same rejection.
    runWrites.delete(runId);
    onError(err);
  });
  return runId;
}

export function runStamped(runId: string): Promise<void> {
  return runWrites.get(runId)?.catch(() => undefined) ?? Promise.resolve();
}

/**
 * WHY: an account that signed in before cannot absorb the anonymous one, so without the claim the run could never
 * go on the board.
 */
export async function claimRun(anonIdToken: string, runId: string): Promise<void> {
  const callable = httpsCallable<{ anonIdToken: string; runId: string }, { ok: true }>(functions(), 'claimRun');
  await callable({ anonIdToken, runId });
}

interface SubmitScoreRequest {
  gameId: GameId;
  runId: string;
  score: number;
  revives: number;
  validator: string;
  nickname: string;
  campus: string;
  emailPrefix: string;
}

/**
 * WHY: the app never writes an entry itself; it sends the result through the callable with the `validator`
 * the page reported.
 */
export async function submitScore(gameId: GameId, entry: EntryFields, validator: string): Promise<{ rank: number | null }> {
  const callable = httpsCallable<SubmitScoreRequest, { rank?: unknown }>(functions(), 'submitScore');
  const { data } = await callable({
    gameId,
    runId: entry.runId,
    score: entry.score,
    revives: entry.revives,
    validator,
    nickname: entry.nickname,
    campus: entry.campus,
    emailPrefix: entry.emailPrefix,
  });
  const rank = data?.rank;
  return { rank: typeof rank === 'number' && Number.isSafeInteger(rank) && rank >= 1 ? rank : null };
}

/** WHY: local on purpose: a personal best, not a claim anyone else relies on. */
// WHY: one instance for the device best and the sound preference; both opened the same `games` id.
const mmkv = createMMKV({ id: 'games' });
const key = (gameId: GameId) => `hi:${gameId}`;

export function getHighScore(gameId: GameId): number {
  const n = mmkv.getNumber(key(gameId)) ?? 0;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function setHighScore(gameId: GameId, score: number): void {
  mmkv.set(key(gameId), score);
}

/** WHY: on until the player turns it off; the ring/silent switch still silences it. */
const KEY = 'sound';

export function getSoundOn(): boolean {
  return mmkv.getBoolean(KEY) ?? true;
}

export function setSoundOn(on: boolean): void {
  mmkv.set(KEY, on);
}
