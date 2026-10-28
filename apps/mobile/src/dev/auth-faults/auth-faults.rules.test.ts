import { describe, expect, test } from 'vitest';
import { classifyAnonFailure, classifySignInError } from '@/features/auth/sign-in-errors.rules';
import { classifyAppCheckError } from '@/platform/app-check.rules';
import { authFaultError } from './auth-faults.rules';

const statusCodes = { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' };
const probeOk = { ok: true as const, ms: 1 };

// The switch is only worth having if each shape lands in the branch it stands for.
describe('authFaultError', () => {
  test('an anonymous sign-in fault classifies as App Check, quota and network', () => {
    expect(classifyAnonFailure(authFaultError('signIn', 'appCheckInvalid'), probeOk).cls).toBe('app_check');
    expect(classifyAnonFailure(authFaultError('signIn', 'throttled'), probeOk).cls).toBe('quota');
    expect(classifyAnonFailure(authFaultError('signIn', 'network'), probeOk).cls).toBe('network');
  });

  test('a Google link fault classifies the same way, with its own codes', () => {
    expect(classifySignInError(authFaultError('signInWithGoogle', 'appCheckInvalid'), statusCodes, probeOk).code).toBe('APP_CHECK');
    expect(classifySignInError(authFaultError('signInWithGoogle', 'throttled'), statusCodes, probeOk).code).toBe('TOO_MANY_REQUESTS');
    expect(classifySignInError(authFaultError('signInWithGoogle', 'network'), statusCodes, probeOk).code).toBe('NETWORK');
  });

  test('a probe fault is a rejected, throttled or unreachable exchange', () => {
    expect(classifyAppCheckError(authFaultError('probe', 'appCheckInvalid'))).toEqual({ kind: 'rejected', code: '403' });
    expect(classifyAppCheckError(authFaultError('probe', 'throttled'))).toEqual({ kind: 'throttled', code: '-8' });
    expect(classifyAppCheckError(authFaultError('probe', 'network'))).toEqual({ kind: 'network' });
  });
});
