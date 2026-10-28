// Color parsing and distance for the SDS codemods: what a literal is, which
// TDS name (SdsColors) holds the same light value, and how far two colors are
// apart (CIEDE2000 on the light values, an alpha color composited on white).
// The inventory's visual-risk bands come from that distance: none < 0.5,
// low < 2, medium < 5, high above.

const NAMED = {
  white: '#FFFFFF', black: '#000000', transparent: '#00000000', red: '#FF0000', blue: '#0000FF',
  green: '#008000', gray: '#808080', grey: '#808080', yellow: '#FFFF00', orange: '#FFA500',
  purple: '#800080', pink: '#FFC0CB', lightgray: '#D3D3D3', lightgrey: '#D3D3D3', darkgray: '#A9A9A9',
  silver: '#C0C0C0', gold: '#FFD700', navy: '#000080',
};
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_RE = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i;

/** `{ r, g, b, a, kind }` for a hex, rgb() or rgba() string (a CSS name only when `allowNamed`), else null. */
export function parseColor(s, allowNamed = false) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  let m = HEX_RE.exec(t);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a, kind: 'hex' };
  }
  m = RGB_RE.exec(t);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a, kind: 'rgb' };
  }
  if (allowNamed && NAMED[t.toLowerCase()]) return { ...parseColor(NAMED[t.toLowerCase()]), kind: 'named' };
  return null;
}

function overWhite(c) {
  if (c.a >= 1) return c;
  return { r: c.r * c.a + 255 * (1 - c.a), g: c.g * c.a + 255 * (1 - c.a), b: c.b * c.a + 255 * (1 - c.a), a: 1 };
}

/** `#RRGGBB`, with an alpha byte when the color is translucent. */
export function hex6(c) {
  const h = (v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase();
  return '#' + h(c.r) + h(c.g) + h(c.b) + (c.a < 1 ? h(c.a * 255) : '');
}

function toLab(c) {
  const f = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = f(c.r);
  const G = f(c.g);
  const B = f(c.b);
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = g(X);
  Y = g(Y);
  Z = g(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** CIEDE2000 between two parsed colors, each composited on white first. */
export function deltaE(c1, c2) {
  const [L1, a1, b1] = toLab(overWhite(c1));
  const [L2, a2, b2] = toLab(overWhite(c2));
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (a, b) => {
    if (a === 0 && b === 0) return 0;
    const x = Math.atan2(b, a) / rad;
    return x < 0 ? x + 360 : x;
  };
  const h1p = hue(a1p, b1);
  const h2p = hue(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T =
    1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
}

/** The inventory's visual-risk band for a distance. */
export function riskOf(dE) {
  if (dE == null) return '';
  if (dE < 0.5) return 'none';
  if (dE < 2) return 'low';
  if (dE < 5) return 'medium';
  return 'high';
}

// When several TDS names share a light value, the literal reads as the first
// of these (white is `background`, not `grey00`).
const NAME_PREF = ['background', 'grey900', 'grey800', 'grey700', 'grey600', 'grey500', 'grey400', 'grey300', 'grey200', 'grey100', 'grey50', 'brand', 'brandLight', 'brandDark'];

/** Lookups over the token tables: the TDS name of a value and the nearest palette step. */
export function colorIndex({ SdsColors, SdsPalette }) {
  const byHex = new Map();
  for (const [name, value] of Object.entries(SdsColors)) {
    const key = value.toUpperCase();
    if (!byHex.has(key)) byHex.set(key, []);
    byHex.get(key).push(name);
  }
  const rank = (name) => (NAME_PREF.indexOf(name) + 1 || 99);
  const palette = [];
  for (const [hue, steps] of Object.entries(SdsPalette)) {
    if (hue === 'static') continue;
    for (const [step, v] of Object.entries(steps)) palette.push({ name: `${hue}[${step}]`, hex: v.light });
  }
  const statics = Object.entries(SdsPalette.static).map(([k, v]) => ({ name: `static.${k}`, hex: v }));
  return {
    /** The SdsColors name whose light value is exactly this color, or null. */
    sdsNameForColor(c) {
      const names = byHex.get(hex6(c).toUpperCase());
      return names ? [...names].sort((a, b) => rank(a) - rank(b))[0] : null;
    },
    /** The nearest palette step (static alphas for a translucent color): `{ name, hex, d }`. */
    nearestPalette(c) {
      const pool = c.a < 1 ? statics.filter((s) => parseColor(s.hex).a < 1) : palette.concat(statics.filter((s) => parseColor(s.hex).a === 1));
      let best = null;
      for (const p of pool) {
        const d = deltaE(c, parseColor(p.hex));
        if (!best || d < best.d) best = { name: p.name, hex: p.hex, d };
      }
      return best;
    },
  };
}
