// WHY: a launch sees one or two responses; the cap only bounds the list.
export const MAX_HANDLED_RESPONSES = 20;

export function shouldHandleResponse(
  triggerType: string | undefined,
  identifier: string,
  handled: readonly string[],
): boolean {
  // WHY: RNFB already routes a tap on a notification FCM drew; expo reports it too, so it would navigate twice.
  if (triggerType === 'push') return false;
  // QUIRK(android): every pending response is replayed to each listener that registers, and again after a reload.
  return !handled.includes(identifier);
}

export function rememberHandled(handled: readonly string[], identifier: string): string[] {
  return [...handled.filter((id) => id !== identifier), identifier].slice(
    -MAX_HANDLED_RESPONSES,
  );
}
