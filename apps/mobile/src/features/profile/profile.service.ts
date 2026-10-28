import { logHandledError } from '@/platform/crashlytics';
import type { UserProfile } from './profile.rules';
import { getProfile, getProfileFromServer, saveProfile } from './profile.repository';

/**
 * WHY: the first-launch intro signs in before the navigator exists, so it raises
 * this flag and the root layout's consumer pushes /profile-setup once navigation is ready.
 */
let pending = false;
const listeners = new Set<() => void>();

export const pendingProfileSetup = {
  set(): void {
    pending = true;
    listeners.forEach((cb) => cb());
  },
  consume(): boolean {
    const p = pending;
    pending = false;
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function requestProfileSetupIfMissing(uid: string): void {
  getProfile(uid)
    .then((profile) => {
      if (!profile) pendingProfileSetup.set();
    })
    .catch((err) => logHandledError('profile/check-after-signin', err));
}

/**
 * WHY: an existing profile is never overwritten, since it may carry a nickname and
 * leaderboard entries; changing it is the profile screen's job.
 */
export function fillProfileIfMissing(uid: string, answers: Pick<UserProfile, 'campus'>): void {
  // WHY: an empty offline cache must not pass for "no profile" and overwrite another device's.
  getProfileFromServer(uid)
    .then((profile) => (profile ? undefined : saveProfile(uid, answers)))
    .catch((err) => logHandledError('profile/fill-from-onboarding', err));
}
