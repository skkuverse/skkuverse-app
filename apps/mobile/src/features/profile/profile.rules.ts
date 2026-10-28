// WHY: pure, no runtime imports, so it loads under `node --test` as is.
import type { Campus } from '@skkuverse/shared';

export interface UserProfile {
  campus: Campus;
  nickname: string | null;
}

const CAMPUSES: readonly Campus[] = ['hssc', 'nsc'];

// WHY: Hangul here means whole syllables only.
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,12}$/;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

export type NicknameCheck = 'ok' | 'tooShort' | 'tooLong' | 'invalidChars';

// WHY: NFC, since pasted text can carry Hangul as separate jamo.
export function normalizeNickname(input: string): string {
  return input.normalize('NFC').trim();
}

export function validateNickname(input: string): NicknameCheck {
  const n = normalizeNickname(input);
  if (n.length < NICKNAME_MIN) return 'tooShort';
  if (n.length > NICKNAME_MAX) return 'tooLong';
  return NICKNAME_PATTERN.test(n) ? 'ok' : 'invalidChars';
}

export function parseProfile(userDoc: Record<string, unknown> | undefined): UserProfile | null {
  const p = userDoc?.profile;
  if (typeof p !== 'object' || p === null) return null;
  const { campus, nickname } = p as Record<string, unknown>;
  if (!CAMPUSES.includes(campus as Campus)) return null;
  return { campus: campus as Campus, nickname: typeof nickname === 'string' ? nickname : null };
}

export type ProfileStep = 'campus' | 'nickname';

export function missingSteps(profile: UserProfile | null, opts: { requireNickname: boolean }): ProfileStep[] {
  const steps: ProfileStep[] = profile ? [] : ['campus'];
  if (opts.requireNickname && !profile?.nickname) steps.push('nickname');
  return steps;
}

/**
 * WHY: offered only after the notices onboarding finished here, since before that
 * `preferredCampus` is the store's default; never saved unasked, because a remote
 * restore of that onboarding does not bring the campus back.
 */
export function prefillFromDevice(settings: {
  onboardingCompleted: boolean;
  preferredCampus: Campus;
}): Pick<UserProfile, 'campus'> | null {
  return settings.onboardingCompleted ? { campus: settings.preferredCampus } : null;
}

export interface SetupState {
  steps: readonly ProfileStep[];
  current: ProfileStep | 'done';
  campus: Campus | null;
  nickname: string;
}

export type SetupAction =
  | { type: 'SET_CAMPUS'; campus: Campus }
  | { type: 'SET_NICKNAME'; nickname: string }
  | { type: 'NEXT' }
  | { type: 'PREV' };

export function initialSetup(
  steps: readonly ProfileStep[],
  opts: { nickname: string | null; prefill?: Pick<UserProfile, 'campus'> | null },
): SetupState {
  return { steps, current: steps[0] ?? 'done', campus: opts.prefill?.campus ?? null, nickname: opts.nickname ?? '' };
}

export function canAdvance(s: SetupState): boolean {
  switch (s.current) {
    case 'campus':
      return s.campus !== null;
    case 'nickname':
      return validateNickname(s.nickname) === 'ok';
    case 'done':
      return false;
  }
}

function move(s: SetupState, by: 1 | -1): SetupState {
  if (s.current === 'done') return s;
  const i = s.steps.indexOf(s.current) + by;
  if (i < 0) return s;
  return { ...s, current: s.steps[i] ?? 'done' };
}

export function setupReducer(s: SetupState, a: SetupAction): SetupState {
  switch (a.type) {
    case 'SET_CAMPUS':
      return { ...s, campus: a.campus };
    case 'SET_NICKNAME':
      return { ...s, nickname: a.nickname };
    case 'NEXT':
      return canAdvance(s) ? move(s, 1) : s;
    case 'PREV':
      return move(s, -1);
  }
}

export function answersOf(s: SetupState): Partial<UserProfile> {
  const out: Partial<UserProfile> = {};
  if (s.steps.includes('campus') && s.campus) out.campus = s.campus;
  if (s.steps.includes('nickname')) out.nickname = normalizeNickname(s.nickname);
  return out;
}
