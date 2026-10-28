import { useAuthStore, useNotificationStore } from '@skkuverse/shared';

export function useEssentialSettings() {
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const masterEnabled = useNotificationStore((s) => s.preferences.enabled);

  const authReady = !!uid && !isAnonymous;

  return { authReady, masterEnabled };
}
