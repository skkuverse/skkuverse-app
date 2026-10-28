import type { Campus } from '@skkuverse/shared';

// WHY: the only place the app names a `GET /journey/routes` id, to route to the detail screen.
export const CAMPUS_ROUTE_IDS = {
  hssc: 'hssc-to-nsc',
  nsc: 'nsc-to-hssc',
} as const satisfies Record<Campus, string>;

// WHY: every answer is planned for the moment it was asked, so poll while focused and in front.
export const ROUTES_REFETCH_MS = 30_000;

// CONTRACT(skkuverse-server): skkuverse-server/src/journey/routes/journey-routes.constants.ts sends GET /journey/routes
// with `Cache-Control: private, max-age=15`; an answer is never held fresh longer.
export const ROUTES_STALE_MS = 15_000;
