// The screenshot comparison: PNG decoding through every row filter, a pixel
// count with its bounding box in points, and the masks that leave live
// regions out. Capturing needs a simulator and is not tested here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { crc32, deflateSync } from 'node:zlib';

import { decodePng, diffImages, loadManifest } from './shots.mjs';

/** A PNG of `pixels` (rows of [r, g, b, a]), each row written with the given filter type. */
function encodePng(pixels, filters) {
  const height = pixels.length;
  const width = pixels[0].length;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  let prev = Buffer.alloc(stride);
  pixels.forEach((row, y) => {
    const line = Buffer.from(row.flat());
    const f = filters[y % filters.length];
    raw[y * (stride + 1)] = f;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? line[x - 4] : 0;
      const b = prev[x];
      const c = x >= 4 ? prev[x - 4] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      raw[y * (stride + 1) + 1 + x] = (line[x] - pred) & 255;
    }
    prev = line;
  });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const W = [255, 255, 255, 255];
const K = [0, 0, 0, 255];
const grid = (w, h, at = {}) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => at[`${x},${y}`] ?? [(x * 40) & 255, (y * 60) & 255, 128, 255]));

test('every row filter decodes back to the pixels', () => {
  const pixels = grid(6, 5);
  const img = decodePng(encodePng(pixels, [0, 1, 2, 3, 4]));
  assert.deepEqual([img.width, img.height, img.channels], [6, 5, 4]);
  img.rows.forEach((row, y) => assert.deepEqual([...row], pixels[y].flat()));
});

test('identical images do not differ; a changed pixel is counted with its box in points', () => {
  const a = decodePng(encodePng(grid(8, 8), [4]));
  assert.deepEqual(diffImages(a, decodePng(encodePng(grid(8, 8), [1]))), { count: 0, box: null });
  const b = decodePng(encodePng(grid(8, 8, { '4,6': W, '5,7': K }), [2]));
  assert.deepEqual(diffImages(a, b, { scale: 2 }), { count: 2, box: { x: 2, y: 3, w: 1, h: 1 } });
});

test('a mask in points leaves its pixels out', () => {
  const a = decodePng(encodePng(grid(8, 8), [0]));
  const b = decodePng(encodePng(grid(8, 8, { '4,6': W, '0,0': K }), [0]));
  assert.equal(diffImages(a, b, { scale: 2, masks: [{ x: 2, y: 3, w: 1, h: 1 }] }).count, 1);
  assert.equal(diffImages(a, b, { scale: 2, masks: [{ x: 2, y: 3, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }] }).count, 0);
});

test('every screen in shots.json has steps, and every mask a reason', () => {
  const { screens, pointWidth } = loadManifest();
  assert.ok(pointWidth > 0);
  const names = new Set();
  for (const s of screens) {
    assert.ok(!names.has(s.name), `${s.name} twice`);
    names.add(s.name);
    assert.ok(s.steps.length > 0, `${s.name} has no steps`);
    for (const m of s.masks ?? []) assert.ok(m.why && [m.x, m.y, m.w, m.h].every(Number.isFinite), `${s.name}: a mask needs x, y, w, h and why`);
  }
});
