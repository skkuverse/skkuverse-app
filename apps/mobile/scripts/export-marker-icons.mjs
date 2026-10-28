#!/usr/bin/env node
/**
 * Bakes a task's marker images (the stop pin, the zoomed-out stop dot, the focused stop's teardrop,
 * the direction label's box) and the building circles badged with a count to PNG at @1x/@2x/@3x, from the geometry the
 * renderer draws them at (marker.constants.ts).
 *
 * The pins are black with a white ring and a white bus glyph: Naver's tint
 * blends, so black takes the tint and white stays white (the marker-dot.png
 * precedent), and one image serves any stop colour. The box is drawn
 * untinted, in its own colours.
 *
 * Run from any cwd; paths resolve relative to this file:
 *   node apps/mobile/scripts/export-marker-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Both files import nothing, so Node loads them as-is (type stripping, on by
// default from Node 22.18; .nvmrc pins 22).
import { SdsColors, SdsPalette } from '../../../packages/shared/src/tokens/colors.ts';
import { BUS_STOP_DOT, BUS_STOP_PIN, LABEL_BOX, ROUTE_STOP_DOT, BADGED_CIRCLE } from '../src/features/map/components/canvas/marker.constants.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const OUT_DIR = resolve(__dirname, '../assets/images');

const RING = 1.5;
const GLYPH_SHARE = 0.6;
/** The step nearest the reference box's border; baked, since the box is never tinted. */
const BOX_BORDER = SdsColors.grey500;

const busSvg = readFileSync(resolve(REPO_ROOT, 'node_modules/@phosphor-icons/core/assets/fill/bus-fill.svg'), 'utf-8');
const BUS_PATH = busSvg.match(/<path d="([^"]+)"/)[1];

/** The bus glyph, white, `size` across its 256 viewBox, centred on (cx, cy). */
function glyph(cx, cy, size) {
  const scale = size / 256;
  return `<path fill="#FFFFFF" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})" d="${BUS_PATH}"/>`;
}

function svg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function busStopDot() {
  const { disc, canvas } = BUS_STOP_DOT;
  const c = canvas / 2;
  const r = disc / 2;
  return svg(
    canvas,
    canvas,
    `<circle cx="${c}" cy="${c}" r="${r + RING / 2}" fill="none" stroke="#FFFFFF" stroke-width="${RING}"/>` +
      `<circle cx="${c}" cy="${c}" r="${r}" fill="#000000"/>` +
      glyph(c, c, disc * GLYPH_SHARE),
  );
}

/** A zoomed-out stop: a black disc in a white ring, no glyph, tinted to the route's colour. */
function routeStopDot() {
  const { disc, ring, canvas } = ROUTE_STOP_DOT;
  const c = canvas / 2;
  const r = disc / 2;
  return svg(
    canvas,
    canvas,
    `<circle cx="${c}" cy="${c}" r="${r + ring / 2}" fill="none" stroke="#FFFFFF" stroke-width="${ring}"/>` +
      `<circle cx="${c}" cy="${c}" r="${r}" fill="#000000"/>`,
  );
}

function busStopPin() {
  const { width, height } = BUS_STOP_PIN;
  const cx = width / 2;
  const r = 16;
  const cy = r + 2;
  // The black tip stops a ring's width short of the canvas, so the white
  // ring's round tip lands on the bottom edge, where the anchor (y = 1) is.
  const tipY = height - RING;
  // The tail runs along the two tangents from the tip to the head.
  const d = tipY - cy;
  const cos = r / d;
  const sin = Math.sqrt(1 - cos * cos);
  const [lx, rx, ty] = [cx - r * sin, cx + r * sin, cy + r * cos];
  const outline = `M${cx} ${tipY}L${rx} ${ty}A${r} ${r} 0 1 0 ${lx} ${ty}Z`;
  return svg(
    width,
    height,
    `<path d="${outline}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="${RING * 2}" stroke-linejoin="round"/>` +
      `<path d="${outline}" fill="#000000"/>` +
      glyph(cx, cy, 2 * r * GLYPH_SHARE),
  );
}

function labelBox() {
  const { bakedWidth, height, radius, border } = LABEL_BOX;
  // Inset by half the stroke, so the whole border lies inside the canvas.
  const inset = border / 2;
  return svg(
    bakedWidth,
    height,
    `<rect x="${inset}" y="${inset}" width="${bakedWidth - border}" height="${height - border}" rx="${radius - inset}" fill="#FFFFFF" stroke="${BOX_BORDER}" stroke-width="${border}"/>`,
  );
}

/**
 * A building circle with a count badge at its top-right, on a square canvas
 * centred on the circle. Baked in its colours, never tinted: the SDK's tint
 * adds to every pixel and would turn the red orange. The fill is the light
 * value of `bg.dataBrand` (pine 700) and the badge `bg.criticalSolid`'s (red
 * 700); a dark scheme's circle stays light-scheme green.
 */
function badgedCircle(text) {
  const { circle, canvas, badge, ring, offset, textSize } = BADGED_CIRCLE;
  const c = canvas / 2;
  const [bx, by] = [c + offset, c - offset];
  return svg(
    canvas,
    canvas,
    `<circle cx="${c}" cy="${c}" r="${circle / 2}" fill="${SdsPalette.pine[700].light}"/>` +
      `<circle cx="${bx}" cy="${by}" r="${badge / 2}" fill="${SdsPalette.red[700].light}" stroke="#FFFFFF" stroke-width="${ring}"/>` +
      `<text x="${bx}" y="${by}" fill="#FFFFFF" font-family="Helvetica Neue, Arial" font-weight="700" font-size="${text.length > 1 ? textSize - 1.5 : textSize}" text-anchor="middle" dominant-baseline="central">${text}</text>`,
  );
}

const BADGE_TEXTS = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', '9p': '9+' };

const ICONS = [
  { name: 'marker-bus-stop', width: BUS_STOP_DOT.canvas, svg: busStopDot() },
  { name: 'marker-bus-stop-pin', width: BUS_STOP_PIN.width, svg: busStopPin() },
  { name: 'marker-route-stop-dot', width: ROUTE_STOP_DOT.canvas, svg: routeStopDot() },
  { name: 'marker-label-box', width: LABEL_BOX.bakedWidth, svg: labelBox() },
  ...Object.entries(BADGE_TEXTS).map(([key, text]) => ({
    name: `marker-circle-badge-${key}`,
    width: BADGED_CIRCLE.canvas,
    svg: badgedCircle(text),
  })),
];

for (const { name, width, svg: source } of ICONS) {
  for (const scale of [1, 2, 3]) {
    const outName = `${name}${scale === 1 ? '' : `@${scale}x`}.png`;
    const resvg = new Resvg(source, { fitTo: { mode: 'width', value: width * scale }, background: 'rgba(0,0,0,0)' });
    const image = resvg.render();
    writeFileSync(resolve(OUT_DIR, outName), image.asPng());
    console.log(`  ${outName}  (${image.width}×${image.height})`);
  }
}
