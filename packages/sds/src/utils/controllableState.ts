/** WHY: controllableState.test.mts loads this file under plain Node, so it imports nothing. */

export function isControlled<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function resolveControllable<T>(value: T | undefined, internal: T): T {
  return isControlled(value) ? value : internal;
}

export interface ControllableChange<T> {
  internal: T;
  notify: boolean;
}

export function requestControllableChange<T>(
  value: T | undefined,
  internal: T,
  next: T,
): ControllableChange<T> {
  const shown = resolveControllable(value, internal);
  if (Object.is(shown, next)) return { internal, notify: false };
  return { internal: isControlled(value) ? internal : next, notify: true };
}
