/** WHY: pressFeedback.test.mts loads this file under plain Node, so it imports types only. */
import type { BgColorName } from '@skkuverse/shared';

/** WHY: code constants rather than tokens, as in SEED: they describe the curve every pressable shares, and a token could be redeclared per element. */
export const SCALE_FEEDBACK_DEPTH = 2;
/** WHY: a wide element measures from a quarter of its width, so a full-width row moves as little as a chip. */
export const SCALE_FEEDBACK_WIDTH_DIVISOR = 4;
/** WHY: the smallest basis, so a tiny target never shrinks by more than 2 in 24. */
export const SCALE_FEEDBACK_MIN_BASIS = 24;

/** WHY: a fixed distance at any size, where a fixed ratio would move a wide button nine times further than a chip (SEED Lynx's `calculateScaleFeedback`). */
export function calculateScaleFeedback(width: number, height: number): number {
  'worklet';
  const basis = Math.max(height, width / SCALE_FEEDBACK_WIDTH_DIVISOR, SCALE_FEEDBACK_MIN_BASIS);
  return basis > 0 ? (basis - SCALE_FEEDBACK_DEPTH) / basis : 1;
}

export type PressableBgToken = {
  [N in BgColorName]: `${N}Pressed` extends BgColorName ? N : never;
}[BgColorName];

export function pressedBgToken(token: PressableBgToken): BgColorName {
  return `${token}Pressed` as BgColorName;
}

/** WHY: `scale` is for an element whose color already shows its state: a color change under the finger would read as the state changing before the finger lifts. */
export type PressFeedbackKind = 'both' | 'color' | 'scale' | 'none';

/** WHY: `content` shrinks only what is inside, for a surface as wide as the screen, which would otherwise pull in from the screen's edges. */
export type ScaleScope = 'self' | 'content';

export interface PressFeedbackInput {
  feedback: PressFeedbackKind;
  hasSurface: boolean;
  disabled: boolean;
  loading: boolean;
  reducedMotion: boolean;
  insideScalingPressable: boolean;
}

export interface PressFeedbackPolicy {
  color: boolean;
  scale: boolean;
}

/** WHY: reduce motion turns the scale off but keeps the color, which does not move (SEED). */
export function resolvePressFeedback(input: PressFeedbackInput): PressFeedbackPolicy {
  if (input.disabled || input.loading || input.feedback === 'none') {
    return { color: false, scale: false };
  }
  return {
    color: input.hasSurface && (input.feedback === 'both' || input.feedback === 'color'),
    scale:
      (input.feedback === 'both' || input.feedback === 'scale') &&
      !input.reducedMotion &&
      !input.insideScalingPressable,
  };
}

/** WHY: it holds while this element is disabled or loading, so a descendant does not start scaling while its parent cannot. */
export function scopeScales(input: Omit<PressFeedbackInput, 'disabled' | 'loading'>): boolean {
  return (
    input.insideScalingPressable ||
    resolvePressFeedback({ ...input, disabled: false, loading: false }).scale
  );
}
