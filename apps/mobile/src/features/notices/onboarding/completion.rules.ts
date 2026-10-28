/**
 * WHY: `abort-no-uid` never opens the gate: falling through to completeOnboarding() left the ghost state
 * (MMKV done, no preferences doc), and no self-heal runs, since Android's linkWithCredential keeps the uid.
 */
export type OnboardingCompletionDecision =
  | 'finalize'
  | 'seed-declined'
  | 'abort-no-uid';

export function decideOnboardingCompletion({
  uid,
  notificationsAccepted,
}: {
  uid: string | null | undefined;
  notificationsAccepted: boolean | null;
}): OnboardingCompletionDecision {
  if (!uid) return 'abort-no-uid';
  // WHY: null means the user never answered, which the SSOT records as declined intent.
  return notificationsAccepted === true ? 'finalize' : 'seed-declined';
}
