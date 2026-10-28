/**
 * WHY: dependency-free and below the stores: pure parsers need it under vitest, which cannot parse the
 * react-native that the store's imports pull in. The type derives from the array, so the two agree.
 */
export const CAMPUSES = ['hssc', 'nsc'] as const;

export type Campus = (typeof CAMPUSES)[number];
