import { authFaultError, type AuthFaultShape, type AuthFaultTarget } from './auth-faults.rules';

const armed = new Map<AuthFaultTarget, AuthFaultShape>();

export function armAuthFault(target: AuthFaultTarget, shape: AuthFaultShape | null): void {
  if (shape === null) armed.delete(target);
  else armed.set(target, shape);
}

export function armedAuthFault(target: AuthFaultTarget): AuthFaultShape | null {
  return armed.get(target) ?? null;
}

export function authFaultFor(target: AuthFaultTarget): Error | null {
  if (!__DEV__) return null;
  const shape = armed.get(target);
  return shape ? authFaultError(target, shape) : null;
}
