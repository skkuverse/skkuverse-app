/**
 * WHY: pass `bg.dataBrand` read in the render as `fallback`, so the default follows the scheme rather
 * than a hex fixed here.
 */
export function hexToColor(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  if (!/^#[\dA-Fa-f]{3,8}$/.test(normalized)) return fallback;
  return normalized;
}
