/**
 * WHY: a glass sheet draws its own surface, so a layer fill painted over it is an opaque block on a tinted card; inside one a layer role paints nothing.
 * surface.test.mts loads this file under plain Node, so it imports types only.
 */
import type { PressableBgToken } from './pressFeedback';

export type Surface = 'opaque' | 'glass';

const LAYER_ROLES: ReadonlySet<PressableBgToken> = new Set(['layerDefault', 'layerFloating']);

/** WHY: its pressed pair follows, so a row pressed on glass shows `bg.transparentPressed`, a veil the glass shows through. */
export function surfaceBg(bg: PressableBgToken, surface: Surface): PressableBgToken {
  return surface === 'glass' && LAYER_ROLES.has(bg) ? 'transparent' : bg;
}
