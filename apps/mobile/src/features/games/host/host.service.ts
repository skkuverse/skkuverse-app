import { logHandledError } from '@/platform/crashlytics';
import type { GameId } from '../games.constants';
import { claimRun, runStamped, submitScore } from './host.repository';
import { submitSetbackOf, type EntryFields, type SubmitSetback } from './host.rules';

export const SUBMIT_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export type SubmitResult = { kind: 'submitted'; rank: number | null } | { kind: SubmitSetback };

/**
 * WHY: waits for the run's stamp, or an entry sent right after a short run could overtake `startRun` and cite no
 * run. Never rejects.
 */
export async function submitResult(input: {
  gameId: GameId;
  entry: EntryFields;
  validator: string | null;
}): Promise<SubmitResult> {
  const { gameId, entry, validator } = input;
  if (validator === null) return { kind: 'rejected' };
  try {
    const { rank } = await withTimeout(
      runStamped(entry.runId).then(() => submitScore(gameId, entry, validator)),
      SUBMIT_TIMEOUT_MS,
    );
    return { kind: 'submitted', rank };
  } catch (err) {
    const setback = submitSetbackOf(err);
    // WHY: not improved is an ordinary answer, not a failure worth a report.
    if (setback !== 'notImproved') logHandledError('games/submit', err);
    return { kind: setback };
  }
}

export async function claimRunOver(anonIdToken: string, runId: string): Promise<boolean> {
  // WHY: the startRun stamp may still be on its way, so claim what exists.
  await runStamped(runId);
  // WHY: claiming is idempotent on the server, so one retry is safe.
  return claimRun(anonIdToken, runId)
    .catch(() => claimRun(anonIdToken, runId))
    .then(() => true)
    .catch((err: unknown) => {
      logHandledError('games/claim-run', err); // WHY: unclaimed, the run reads as played before signing in
      return false;
    });
}
