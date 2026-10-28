/**
 * WHY: the server picks data colors for the light row, and the app owns dark mode, so it lifts them
 * there rather than asking for a second palette. WCAG 2.x, not APCA: it is what platform checkers report.
 */
const HEX6 = /^#?([0-9A-Fa-f]{6})$/;

function normalize(color: string): string | null {
  const match = HEX6.exec(color);
  return match ? `#${match[1].toUpperCase()}` : null;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function alphaOf(hex: string): number {
  return hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function over(color: string, background: string): string {
  const alpha = alphaOf(color);
  const bg = channels(background);
  return toHex(channels(color).map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))));
}

export function contrast(foreground: string, background: string): number {
  const [hi, lo] = [luminance(over(foreground, background)), luminance(background)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Oklab = [number, number, number];

function toOklab(hex: string): Oklab {
  const [r, g, b] = channels(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Oklab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return toHex(
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(fromLinear),
  );
}

export function oklabHue(hex: string): number {
  const [, a, b] = toOklab(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

export interface LegibleOnOptions {
  /** WHY: 4.5 is WCAG AA for body text. */
  minContrast?: number;
  /** WHY: an alpha from 0 to 1 (a badge fills at 0x1F); the text is measured on that tint over `background`. */
  fill?: number;
}

/** EVIDENCE: 2^-20 of the way to white is far below one 8-bit step. */
const STEPS = 20;

/**
 * WHY: mixes in OKLab, where moving toward white or black keeps the hue (line 1 stays blue, not sRGB's
 * lavender). Input that is not six hex digits comes back unchanged, so a caller's fallback applies.
 */
export function legibleOn(color: string, background: string, options: LegibleOnOptions = {}): string {
  const { minContrast = 4.5, fill = 0 } = options;
  const fg = normalize(color);
  const ground = normalize(background);
  if (!fg || !ground) return color;
  const tint = Math.round(fill * 255).toString(16).padStart(2, '0');
  const reads = (candidate: string) =>
    contrast(candidate, fill > 0 ? over(`${candidate}${tint}`, ground) : ground) >= minContrast;
  if (reads(fg)) return fg;

  const start = toOklab(fg);
  const target: Oklab = luminance(ground) < 0.18 ? [1, 0, 0] : [0, 0, 0];
  const at = (t: number) => fromOklab(start.map((v, i) => v + (target[i] - v) * t) as Oklab);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (reads(at(mid))) hi = mid;
    else lo = mid;
  }
  return at(hi);
}
