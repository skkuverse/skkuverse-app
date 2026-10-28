import { useAuthStore } from '@skkuverse/shared';

export function useOnboardingLanding() {
  // WHY: the intro can leave a user signed in but not onboarded, and the existing-account link would
  // run a second, pointless signInWithDeviceMigration on the account they are already on.
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  return { isAnonymous };
}
