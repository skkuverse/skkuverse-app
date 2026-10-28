/** WHY: free of React Native, so its node test can load it. */
import type { FgColorName, SemanticColors } from '@skkuverse/shared';

export type TxtColor = FgColorName;

/** WHY: a string that is no role (from untyped code) is drawn as given rather than dropped. */
export function resolveTxtColor(color: string | undefined, fg: SemanticColors['fg']): string {
  if (color === undefined) return fg.neutral;
  return Object.prototype.hasOwnProperty.call(fg, color) ? (fg as Readonly<Record<string, string>>)[color] : color;
}
