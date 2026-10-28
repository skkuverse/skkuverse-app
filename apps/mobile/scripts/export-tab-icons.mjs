#!/usr/bin/env node
/**
 * Exports Phosphor SVGs to PNG assets for iOS NativeTabs.
 *
 * Phosphor ships outline (regular) + filled (fill) variants natively as
 * separate SVG files designed by hand — no string manipulation needed.
 * iOS NativeTabs Icon `src={{ default, selected }}` maps to these two PNGs.
 *
 * Colors are baked at export time (inactive = gray, active = dark) so the
 * visual is correct regardless of how iOS UITabBarItem rendering mode treats
 * the asset (template tint vs original).
 *
 * Run from any cwd — paths resolve relative to this file:
 *   node apps/mobile/scripts/export-tab-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PHOSPHOR_ASSETS = resolve(REPO_ROOT, 'node_modules/@phosphor-icons/core/assets');
const OUT_DIR = resolve(__dirname, '../assets/tab-icons');

// File prefix → Phosphor source name (filename minus extension).
// Prefix is icon-shape based (not route name) for naming consistency.
// Mirrors TAB_GLYPHS in apps/mobile/src/bootstrap/tab-icons.constants.ts,
// scale included: a glyph that draws larger than its neighbours (the bus,
// whose ink box is a third wider) is shrunk inside its slot by widening the
// SVG's viewBox, so the PNG canvas stays the slot's size.
const ICONS = [
  { tab: 'squares-four', phosphor: 'squares-four', scale: 1 },
  { tab: 'megaphone-simple', phosphor: 'megaphone-simple', scale: 1 },
  { tab: 'map-trifold', phosphor: 'map-trifold', scale: 1 },
  { tab: 'bus', phosphor: 'bus', scale: 0.86 },
];

/** Phosphor's glyphs are drawn on a 256-unit box. */
const PHOSPHOR_BOX = 256;

/** Widens the viewBox so the glyph fills `scale` of the canvas, centred. */
function scaledViewBox(svg, scale) {
  if (scale === 1) return svg;
  const box = PHOSPHOR_BOX / scale;
  const pad = (box - PHOSPHOR_BOX) / 2;
  const viewBox = `viewBox="0 0 ${PHOSPHOR_BOX} ${PHOSPHOR_BOX}"`;
  if (!svg.includes(viewBox)) throw new Error(`expected ${viewBox} in the Phosphor SVG`);
  return svg.replace(viewBox, `viewBox="${-pad} ${-pad} ${box} ${box}"`);
}

const BASE_SIZE = 22;
const COLOR_INACTIVE = '#B0B8C1';
const COLOR_ACTIVE = '#191F28';

mkdirSync(OUT_DIR, { recursive: true });

const VARIANTS = [
  { suffix: '-outline', dir: 'regular', filenameSuffix: '', color: COLOR_INACTIVE },
  { suffix: '-filled', dir: 'fill', filenameSuffix: '-fill', color: COLOR_ACTIVE },
];

let count = 0;
for (const { tab, phosphor, scale } of ICONS) {
  for (const variant of VARIANTS) {
    const svgPath = resolve(
      PHOSPHOR_ASSETS,
      variant.dir,
      `${phosphor}${variant.filenameSuffix}.svg`,
    );
    const rawSvg = readFileSync(svgPath, 'utf-8');
    const tinted = scaledViewBox(rawSvg.replaceAll('currentColor', variant.color), scale);

    for (const density of [1, 2, 3]) {
      const size = BASE_SIZE * density;
      const densitySuffix = density === 1 ? '' : `@${density}x`;
      const outName = `${tab}${variant.suffix}${densitySuffix}.png`;
      const outPath = resolve(OUT_DIR, outName);

      const resvg = new Resvg(tinted, {
        fitTo: { mode: 'width', value: size },
        background: 'rgba(0,0,0,0)',
      });
      writeFileSync(outPath, resvg.render().asPng());
      console.log(`  ${outName}  (${size}×${size})`);
      count++;
    }
  }
}

console.log(`\n✅ Exported ${count} Phosphor PNG files to ${OUT_DIR}`);
