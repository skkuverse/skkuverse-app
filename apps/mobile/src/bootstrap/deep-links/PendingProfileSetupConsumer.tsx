import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { pendingProfileSetup } from '@/features/profile/profile.service';

// WHY: keeps listening, since the profile read finishes after the intro has already closed.
export function PendingProfileSetupConsumer() {
  const navState = useRootNavigationState();
  useEffect(() => {
    if (!navState?.key) return;
    const tryConsume = () => {
      if (!pendingProfileSetup.consume()) return;
      requestAnimationFrame(() => router.push('/profile-setup'));
    };
    tryConsume();
    return pendingProfileSetup.subscribe(tryConsume);
  }, [navState?.key]);
  return null;
}
