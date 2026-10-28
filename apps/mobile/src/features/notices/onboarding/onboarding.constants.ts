import type { OnboardingStepKey } from '@/platform/analytics.types';

// WHY: closing the in-app browser on this survey advances the wizard.
export const UNSUPPORTED_DEPT_SURVEY_URL = 'https://forms.gle/2ivj12dpZ7SRKZN9A';

export const STEP_KEYS: Record<number, OnboardingStepKey> = {
  1: 'campus',
  2: 'primary_dept',
  3: 'interest_dept',
  4: 'login',
  5: 'notification',
  6: 'notice_categories',
  7: 'completion',
};
