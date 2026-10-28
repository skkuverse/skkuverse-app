export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// WHY: a dev-only switch that bypasses every gate condition for QA; set it to `__DEV__` to use it, since `__DEV__` is false in shipped builds.
export const DEV_ALWAYS_SHOW: boolean = false;
