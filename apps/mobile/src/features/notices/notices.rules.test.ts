/**
 * The notices tab gate: the list only for a signed-in user who finished the
 * notices onboarding.
 */
import { describe, expect, it } from 'vitest';
import { showsOnboardingLanding } from './notices.rules';

describe('showsOnboardingLanding', () => {
  it.each([
    { isAnonymous: true, onboardingCompleted: false, landing: true },
    { isAnonymous: true, onboardingCompleted: true, landing: true },
    { isAnonymous: false, onboardingCompleted: false, landing: true },
    { isAnonymous: false, onboardingCompleted: true, landing: false },
  ])('anonymous $isAnonymous, onboarded $onboardingCompleted -> landing $landing', ({ landing, ...inputs }) => {
    // Act
    const shows = showsOnboardingLanding(inputs);

    // Assert
    expect(shows).toBe(landing);
  });
});
