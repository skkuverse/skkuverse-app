import { describe, it, expect } from 'vitest';
import { isMissingPrefsDocError } from './prefs-write-errors.rules';

// Synthesize a Firebase-shaped error.
const fbErr = (code: string) => Object.assign(new Error('mock'), { code });

describe('isMissingPrefsDocError — recoverable (doc may be missing)', () => {
  // This case is why the module exists: an update on a missing document
  // reaches the client as PERMISSION_DENIED, not NOT_FOUND.
  it('treats firestore/permission-denied as recoverable — a missing doc looks like this', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/permission-denied'))).toBe(true);
  });

  it('treats a bare permission-denied (no namespace) as recoverable', () => {
    expect(isMissingPrefsDocError(fbErr('permission-denied'))).toBe(true);
  });

  // not-found is not observed in practice, but an admin SDK path or a later
  // backend change could surface it, so it is accepted too.
  it('treats firestore/not-found as recoverable', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/not-found'))).toBe(true);
  });
});

describe('isMissingPrefsDocError — NOT recoverable', () => {
  // 네트워크 dead spot 에서 문서를 새로 만들지 않기 위한 가드.
  it('rejects firestore/unavailable (network dead spot — do not seed)', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/unavailable'))).toBe(false);
  });

  it('rejects firestore/deadline-exceeded', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/deadline-exceeded'))).toBe(false);
  });

  it('rejects an unrelated code', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/invalid-argument'))).toBe(false);
  });

  it('rejects null / undefined / non-object', () => {
    expect(isMissingPrefsDocError(null)).toBe(false);
    expect(isMissingPrefsDocError(undefined)).toBe(false);
    expect(isMissingPrefsDocError('permission-denied')).toBe(false);
  });

  it('rejects an object with no code, or a non-string code', () => {
    expect(isMissingPrefsDocError({})).toBe(false);
    expect(isMissingPrefsDocError({ code: 42 })).toBe(false);
  });
});
