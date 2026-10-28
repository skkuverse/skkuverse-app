import { describe, expect, test } from 'vitest';
import {
  missingSteps,
  parseProfile,
  prefillFromDevice,
  validateNickname,
} from './profile.rules';

describe('validateNickname', () => {
  test('Hangul, Latin, digits and underscore within 2–12 characters', () => {
    for (const n of ['파도', 'wave_rider12', '가나다라마바사아자차카타', 'ab', 'A1_']) {
      expect(validateNickname(n), n).toBe('ok');
    }
  });
  test('length is counted in characters, surrounding spaces ignored', () => {
    expect(validateNickname('파')).toBe('tooShort');
    expect(validateNickname('  파  ')).toBe('tooShort');
    expect(validateNickname('')).toBe('tooShort');
    expect(validateNickname('가나다라마바사아자차카타파')).toBe('tooLong');
    expect(validateNickname('wave_rider_12')).toBe('tooLong');
  });
  test('decomposed Hangul (pasted NFD) is composed first', () => {
    expect(validateNickname('파도'.normalize('NFD'))).toBe('ok');
  });
  test('anything outside the set is rejected', () => {
    for (const n of ['wave rider', 'wave!', '파도🌊', 'ㄱㄴㄷ', 'ｗａｖｅ', '파도.']) {
      expect(validateNickname(n), n).toBe('invalidChars');
    }
  });
});

describe('parseProfile', () => {
  test('reads a full or partial profile', () => {
    expect(parseProfile({ profile: { campus: 'hssc', nickname: '파도왕' } })).toStrictEqual({
      campus: 'hssc',
      nickname: '파도왕',
    });
    expect(parseProfile({ profile: { campus: 'nsc' } })).toStrictEqual({ campus: 'nsc', nickname: null });
  });
  test('no profile, or an unusable one, is null', () => {
    expect(parseProfile(undefined)).toBe(null);
    expect(parseProfile({ locale: 'ko' })).toBe(null);
    expect(parseProfile({ profile: { campus: 'seoul' } })).toBe(null);
    expect(parseProfile({ profile: 'x' })).toBe(null);
  });
  test('a malformed nickname reads as absent', () => {
    expect(parseProfile({ profile: { campus: 'hssc', nickname: 7 } })).toStrictEqual({ campus: 'hssc', nickname: null });
  });
});

describe('missingSteps', () => {
  const full = { campus: 'hssc' as const, nickname: '파도왕' };
  test('no profile: the campus, then the nickname if asked for', () => {
    expect(missingSteps(null, { requireNickname: false })).toStrictEqual(['campus']);
    expect(missingSteps(null, { requireNickname: true })).toStrictEqual(['campus', 'nickname']);
  });
  test('a full profile asks nothing', () => {
    expect(missingSteps(full, { requireNickname: true })).toStrictEqual([]);
  });
  test('only the nickname', () => {
    expect(missingSteps({ ...full, nickname: null }, { requireNickname: true })).toStrictEqual(['nickname']);
    expect(missingSteps({ ...full, nickname: null }, { requireNickname: false })).toStrictEqual([]);
  });
});

describe('prefillFromDevice', () => {
  test('a finished notices onboarding suggests its campus', () => {
    expect(prefillFromDevice({ onboardingCompleted: true, preferredCampus: 'nsc' })).toStrictEqual({ campus: 'nsc' });
  });
  test('otherwise preferredCampus is only a default, so nothing is suggested', () => {
    expect(prefillFromDevice({ onboardingCompleted: false, preferredCampus: 'hssc' })).toBe(null);
  });
});
