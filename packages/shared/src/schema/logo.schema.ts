// CONTRACT(skkuverse-server): skkuverse-server/src/miniapps/miniapps.wire.ts. A mini app's logos and
// a home link tile's `icon` share this shape, so its schema is shared (ADR 0020 D2).
import { z } from 'zod';
import { text } from './tolerant';
import type { Logo } from './logo.types';

export type { Logo } from './logo.types';

// WHY: the uri goes straight to an image loader; `javascript:` and `data:` are not images to fetch.
const HTTP_URL = /^https?:\/\//;

export const logoSchema = z.union([
  z
    .object({ kind: z.literal('remote'), uri: z.string().regex(HTTP_URL) })
    .transform(({ uri }) => ({ kind: 'remote', uri }) satisfies Logo),
  z
    .object({ kind: z.literal('emoji'), emoji: text })
    .transform(({ emoji }) => ({ kind: 'emoji', emoji }) satisfies Logo),
]);
