/**
 * WHY: import-free, so a node test pins each conflict case with no React Native or Firebase runtime. Cases here:
 * C1' uid switch, C2 onboarding decline, C3 concurrent seeds, C4 split write, C6 anonymous launch, C8 OS
 * revoke, C9 unanswered accept; each function names its own, and the callers only carry out what these return.
 */

export interface ArrayFieldValues<S> {
  arrayUnion: (value: string) => S;
  arrayRemove: (value: string) => S;
}

/**
 * WHY: (C4) on writes the master switch and the id in one mutation, or the derive can apply them out of
 * order and lose the topics. A decliner's notices stay off under `categoryEnabled.notices`. Off removes
 * only the id, since the master switch also carries notices.
 */
export function miniAppSubscriptionMutation<S>(
  miniAppId: string,
  on: boolean,
  fv: ArrayFieldValues<S>,
): Record<string, unknown> {
  if (on) {
    return { enabled: true, miniAppSelections: fv.arrayUnion(miniAppId) };
  }
  return { miniAppSelections: fv.arrayRemove(miniAppId) };
}

/**
 * WHY: (C1') preferences are per uid and nothing copies them; signing into an existing Google account or
 * signing out lands on a new uid, so the device's choice is written again. Only on a uid transition,
 * so an unsubscribe made on another device of the account is not undone.
 */
export function optInsToReapply({
  prevUid,
  uid,
  optIns,
}: {
  prevUid: string | null;
  uid: string | null;
  optIns: readonly string[];
}): string[] {
  if (!prevUid || !uid || prevUid === uid) return [];
  return [...optIns];
}

/**
 * WHY: (C2) the onboarding decline is of notices, which the caller turns off, so a mini-app subscriber
 * keeps the master switch on. This device's record counts for the window before the listener delivers.
 */
export function enabledAfterOnboardingDecline({
  miniAppSelections,
  optIns,
}: {
  miniAppSelections: readonly string[] | undefined;
  optIns: readonly string[];
}): boolean {
  return (miniAppSelections?.length ?? 0) > 0 || optIns.length > 0;
}

type PermissionStatus = 'authorized' | 'provisional' | 'denied' | 'notDetermined' | string;

/**
 * WHY: (C8) a device's `notificationsEnabled` follows the preference, not the OS, so the server alone
 * says subscribed after a revoke; a toggle shows what this device will receive.
 */
export function isMiniAppPushOn(
  preferences: { enabled?: boolean; miniAppSelections?: readonly string[] },
  miniAppId: string,
  permissionStatus: PermissionStatus,
): boolean {
  const granted = permissionStatus === 'authorized' || permissionStatus === 'provisional';
  return (
    granted &&
    preferences.enabled === true &&
    (preferences.miniAppSelections ?? []).includes(miniAppId)
  );
}

/**
 * WHY: (C3) launch, the auth transition, sign-in and each setter's self-heal can seed a missing document
 * at once; two get-then-`set()` runs let the second wipe the first caller's follow-up write.
 */
export function createKeyedSingleFlight<T>(): (
  key: string,
  run: () => Promise<T>,
) => Promise<T> {
  const inFlight = new Map<string, Promise<T>>();
  return (key, run) => {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const attempt = run().finally(() => {
      if (inFlight.get(key) === attempt) inFlight.delete(key);
    });
    inFlight.set(key, attempt);
    return attempt;
  };
}

/**
 * WHY: (C6) a subscriber can be anonymous and never onboarded, and the launch re-registration heals a
 * stale topic replica. 'notDetermined' stays no: asking at launch would raise the OS prompt uninvited.
 */
export function shouldQueryPermissionAtLaunch({
  onboardingCompleted,
  persistedStatus,
  optIns,
}: {
  onboardingCompleted: boolean;
  persistedStatus: PermissionStatus;
  optIns: readonly string[];
}): boolean {
  if (persistedStatus === 'notDetermined') return false;
  return onboardingCompleted || optIns.length > 0;
}

/** WHY: (C9) a kill while the OS dialog or Settings was up leaves an accept with no answer, which is not a yes. */
export function pendingOptInRetries(
  due: readonly string[],
  granted: boolean,
): { write: string[]; deny: string[] } {
  return granted ? { write: [...due], deny: [] } : { write: [], deny: [...due] };
}
