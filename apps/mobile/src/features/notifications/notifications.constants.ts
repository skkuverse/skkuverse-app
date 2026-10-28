/** WHY: a toggle on a mini app that never sends would record a subscription nothing delivers to. */
export const PUSH_MINIAPP_IDS: readonly string[] = ['eskara-2026'];

/**
 * WHY: after the window the ask is gone and the toggle stays only as a way off; an opt-in no longer
 * re-applies on a uid change, nor keeps the launch re-registration on for a never-onboarded device.
 */
const PUSH_WINDOW_END_MS: Readonly<Record<string, number>> = {
  'eskara-2026': Date.parse('2026-10-03T00:00:00+09:00'),
};

export function hasMiniAppPush(miniAppId: string | undefined | null, nowMs: number): boolean {
  if (!miniAppId || !PUSH_MINIAPP_IDS.includes(miniAppId)) return false;
  const end = PUSH_WINDOW_END_MS[miniAppId];
  return end !== undefined && nowMs < end;
}

/** WHY: the toggle outlives the window while this device still receives the push, as an anonymous user's only way off. */
export function hasMiniAppPushToggle(miniAppId: string | undefined | null, nowMs: number, receivesPush: boolean): boolean {
  if (!miniAppId || !PUSH_MINIAPP_IDS.includes(miniAppId)) return false;
  return receivesPush || hasMiniAppPush(miniAppId, nowMs);
}

export function activeMiniAppOptIns(optIns: readonly string[], nowMs: number): string[] {
  return optIns.filter((id) => hasMiniAppPush(id, nowMs));
}
