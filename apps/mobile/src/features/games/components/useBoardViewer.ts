import { useAuthStore } from '@skkuverse/shared';

export function useBoardViewer() {
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  return { uid, isAnonymous };
}
