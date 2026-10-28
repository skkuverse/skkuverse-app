import { useEffect, useState } from 'react';
import { logHandledError } from '@/platform/crashlytics';
import type { UserProfile } from './profile.rules';
import { watchProfile } from './profile.repository';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: UserProfile | null }
  | { status: 'error' };

const SIGNED_OUT: ProfileState = { status: 'ready', profile: null };

/** WHY: live rather than fetched, so whoever asked for the separate setup route sees its answer when it closes. */
export function useUserProfile(uid: string | null): ProfileState {
  // WHY: keyed by uid, so the render right after a sign-in never shows the previous account's answer.
  const [state, setState] = useState<{ uid: string | null; value: ProfileState }>({
    uid: null,
    value: SIGNED_OUT,
  });

  useEffect(() => {
    if (!uid) return;
    return watchProfile(
      uid,
      (profile) => setState({ uid, value: { status: 'ready', profile } }),
      (error) => {
        logHandledError('profile/watch', error);
        setState({ uid, value: { status: 'error' } });
      },
    );
  }, [uid]);

  // WHY: signed out is answered here, not written into state by the effect, so it holds from the render the uid goes away.
  if (!uid) return SIGNED_OUT;
  return state.uid === uid ? state.value : { status: 'loading' };
}
