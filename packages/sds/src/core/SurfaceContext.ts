import { createContext, useContext } from 'react';
import type { Surface } from './surface';

export const SurfaceContext = createContext<Surface>('opaque');

/** WHY: `Pressable` already drops a layer fill inside a glass sheet; a view that paints its own panel reads this to drop it too. */
export function useSurface(): Surface {
  return useContext(SurfaceContext);
}
