// The baked marker images are the size the renderer draws them at
// (marker.constants.ts) at every density, so an asset and its geometry
// cannot drift. Rerun export-marker-icons.mjs when this fails.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BUS_STOP_DOT, BUS_STOP_PIN, LABEL_BOX, BADGED_CIRCLE } from '../src/features/map/components/canvas/marker.constants.ts';

const IMAGES = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/images');

const EXPECTED = [
  { name: 'marker-bus-stop', width: BUS_STOP_DOT.canvas, height: BUS_STOP_DOT.canvas },
  { name: 'marker-bus-stop-pin', width: BUS_STOP_PIN.width, height: BUS_STOP_PIN.height },
  { name: 'marker-label-box', width: LABEL_BOX.bakedWidth, height: LABEL_BOX.height },
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '9p'].map((key) => ({
    name: `marker-circle-badge-${key}`,
    width: BADGED_CIRCLE.canvas,
    height: BADGED_CIRCLE.canvas,
  })),
];

/** Width and height from a PNG's IHDR chunk, which follows the 8-byte signature. */
function pngSize(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('latin1', 12, 16), 'IHDR', `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('marker images', () => {
  for (const { name, width, height } of EXPECTED) {
    for (const scale of [1, 2, 3]) {
      const file = `${name}${scale === 1 ? '' : `@${scale}x`}.png`;
      it(`${file} is ${width}×${height} pt at @${scale}x`, () => {
        assert.deepEqual(pngSize(resolve(IMAGES, file)), { width: width * scale, height: height * scale });
      });
    }
  }
});
