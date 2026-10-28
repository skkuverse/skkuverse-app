export function showsOnboardingLanding({
  isAnonymous,
  onboardingCompleted,
}: {
  isAnonymous: boolean;
  onboardingCompleted: boolean;
}): boolean {
  return isAnonymous || !onboardingCompleted;
}
