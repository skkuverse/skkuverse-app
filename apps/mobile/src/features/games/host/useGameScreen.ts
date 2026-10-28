import { authStore, useAuthStore } from '@skkuverse/shared';
import { getHighScore, getSoundOn, setHighScore, setSoundOn, startRun } from './host.repository';

function readUid(): string | null {
  return authStore.getState().uid;
}

/** WHY: the functions are the modules' own, so their identity never changes between renders. */
export function useGameScreen() {
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const email = useAuthStore((s) => s.email);
  return { uid, isAnonymous, email, readUid, startRun, getHighScore, setHighScore, getSoundOn, setSoundOn };
}
