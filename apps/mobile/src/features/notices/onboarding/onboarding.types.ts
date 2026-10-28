import type { Campus } from '@skkuverse/shared';

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OnboardingState {
  step: OnboardingStep;
  campus: Campus | null;
  primaryDeptId: string | null;
  interestDeptIds: string[];
  userName: string | null;
  // WHY: null until step 5 is answered; false skips step 6.
  notificationsAccepted: boolean | null;
  // WHY: reused at finalize, since assembling twice exposes the tabsConfig race.
  seededPickerSelections: Record<string, string[]> | null;
  /** WHY: frozen at mount; read live, signing in mid-wizard would change the ladder under the user. */
  skipLogin: boolean;
}

export type OnboardingAction =
  | { type: 'SET_CAMPUS'; campus: Campus }
  | { type: 'SET_PRIMARY_DEPT'; deptId: string }
  | { type: 'SKIP_PRIMARY_DEPT' }
  | { type: 'TOGGLE_INTEREST_DEPT'; deptId: string }
  | { type: 'CLEAR_INTEREST_DEPTS' }
  | { type: 'SET_USER'; name: string }
  | { type: 'ACCEPT_NOTIFICATIONS'; pickerSelections: Record<string, string[]> }
  | { type: 'DECLINE_NOTIFICATIONS' }
  | { type: 'NEXT' }
  | { type: 'PREV' };
