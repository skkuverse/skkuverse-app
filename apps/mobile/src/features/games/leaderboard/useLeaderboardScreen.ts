import { useAuthStore } from '@skkuverse/shared';

export function useLeaderboardScreen() {
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  return { uid, isAnonymous };
}
