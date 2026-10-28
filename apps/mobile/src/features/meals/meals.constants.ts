export const MEALS_CODES = ['B', 'L', 'D', 'S', 'R'] as const;

// EVIDENCE: an estimate, not measured: GET /meals serves no cafeteria hours, so a meal counts as over at these KST hours.
export const MEALS_OVER_AT_HOUR = { B: 10, L: 15, D: 20 } as const;
