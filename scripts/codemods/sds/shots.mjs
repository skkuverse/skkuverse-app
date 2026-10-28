#!/usr/bin/env node
// Screenshots for the SDS migration batches: capture the main screens on the
// iOS simulator the same way every time, and compare two captures pixel by
// pixel. A batch meant to change nothing on screen must compare identical.
//
//   node scripts/codemods/sds/shots.mjs capture <dir> [screen...]
//   node scripts/codemods/sds/shots.mjs diff <before-dir> <after-dir> [screen...]
//
// capture drives the simulator through shots.json: each screen is a list of
// steps (relaunch, open a deep link, tap an element by its accessibility
// label, tap a point, swipe, wait), after which the dev-build warning toast is
// closed and <dir>/<screen>.png is written. A tap step may name the label it
// expects to appear (`until`); it is retried until that label shows. A
// screen that continues from another names it (`from`), and capturing it
// alone replays that screen's steps first. The status bar is pinned to 9:41
// with full signal and battery, and the appearance to light, before the first
// screen. It runs on the booted simulator shots.json `simulator` names, signed
// in, with a dev build and Metro serving the working tree. AXe drives the
// taps; XcodeBuildMCP bundles it (found under ~/.npm/_npx, or set
// AXE=/path/to/axe). shots.json `omitted` lists the screens it cannot reach.
//
// diff compares the PNGs of the same name and ignores each screen's masks in
// shots.json: regions whose pixels change on their own (live data, a pager,
// an animation). A screen with a translucent layer over something that
// animates may also set `tolerance.channel`, a per-channel difference too
// small to be a design change. It prints the differing pixel count and bounding box per
// screen, in points, and exits 1 when any screen differs.
//
// The game-result shot plays one run, which records a run under the signed-in account, and live data
// outside the masks changes by day: capture before and after in one session. A change inside a mask goes
// unseen, so check a masked part by hand when a batch touches it.
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';

import { repoRoot } from './tokens.mjs';

const MANIFEST = resolve(repoRoot, 'scripts/codemods/sds/shots.json');

// ── PNG ──

/** `{ width, height, channels, rows }` of an 8-bit, non-interlaced RGB or RGBA PNG; `rows[y]` is a Buffer. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) throw new Error(`unsupported PNG (depth ${depth}, color type ${colorType}, interlace ${interlace})`);
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0, p = 0; y < height; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    rows.push(line);
    prev = line;
  }
  return { width, height, channels, rows };
}

/**
 * The pixels that differ between two decoded images outside `masks`
 * (rectangles in points, `scale` pixels per point) by more than `tolerance`
 * in some channel. Returns `{ count, box }`, `box` in points or null.
 */
export function diffImages(a, b, { masks = [], scale = 1, tolerance = 0 } = {}) {
  if (a.width !== b.width || a.height !== b.height) return { count: a.width * a.height, box: null, sizeMismatch: true };
  const masked = (x, y) => masks.some((m) => x >= m.x * scale && x < (m.x + m.w) * scale && y >= m.y * scale && y < (m.y + m.h) * scale);
  let count = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < a.height; y++) {
    const ra = a.rows[y];
    const rb = b.rows[y];
    for (let x = 0; x < a.width; x++) {
      const ia = x * a.channels;
      const ib = x * b.channels;
      if (Math.abs(ra[ia] - rb[ib]) <= tolerance && Math.abs(ra[ia + 1] - rb[ib + 1]) <= tolerance && Math.abs(ra[ia + 2] - rb[ib + 2]) <= tolerance) continue;
      if (masked(x, y)) continue;
      count++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  const pt = (v) => Math.round(v / scale);
  return { count, box: count ? { x: pt(x0), y: pt(y0), w: pt(x1 - x0 + 1), h: pt(y1 - y0 + 1) } : null };
}

// ── simulator ──

function run(cmd, args, { allowFail = false } = {}) {
  const out = spawnSync(cmd, args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 256 * 1024 * 1024 });
  if (out.status !== 0 && !allowFail) throw new Error(`${cmd} ${args.join(' ')} failed: ${(out.error?.message ?? out.stderr ?? '').slice(0, 500)}`);
  return out;
}
const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.round(s * 1000));

function findAxe() {
  if (process.env.AXE) return process.env.AXE;
  const npx = join(homedir(), '.npm/_npx');
  for (const dir of existsSync(npx) ? readdirSync(npx) : []) {
    const p = join(npx, dir, 'node_modules/xcodebuildmcp/bundled/axe');
    if (existsSync(p)) return p;
  }
  throw new Error('AXe not found: set AXE=/path/to/axe (XcodeBuildMCP bundles it)');
}

/** The UDID of the one booted simulator called `name`. */
function bootedUdid(name) {
  const devices = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']).stdout).devices;
  const matches = Object.values(devices).flat().filter((d) => d.name === name);
  if (matches.length !== 1) throw new Error(`${matches.length} booted simulators are called "${name}"; boot exactly one (shots.json simulator)`);
  return matches[0].udid;
}

/** Pins the status bar and the light appearance, so the chrome is the same in every capture. */
function prepare(udid) {
  run('xcrun', ['simctl', 'ui', udid, 'appearance', 'light']);
  run('xcrun', ['simctl', 'status_bar', udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--batteryState', 'charged', '--batteryLevel', '100']);
}

/** Every element of the AX tree with a label, flattened. */
function elements(axe, udid) {
  const out = [];
  const walk = (n) => {
    if (n.AXLabel) out.push({ label: n.AXLabel, type: n.type, frame: n.frame });
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of JSON.parse(run(axe, ['describe-ui', '--udid', udid]).stdout)) walk(n);
  return out;
}

/** Whether an element labelled `label` appears within `seconds`. */
function waitForLabel(axe, udid, label, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (elements(axe, udid).some((e) => e.label === label)) return true;
    sleep(1);
  }
  return false;
}

/** Closes the dev build's "Open debugger to view warnings" toast, which covers the tab bar, by its close button. */
function closeWarningToast(axe, udid) {
  for (let i = 0; i < 3; i++) {
    const toast = elements(axe, udid).find((e) => /Open debugger to view (warnings|errors)/.test(e.label));
    if (!toast) return;
    const { x, y, width, height } = toast.frame;
    run(axe, ['tap', '-x', String(Math.round(x + width - 22)), '-y', String(Math.round(y + height / 2)), '--udid', udid]);
    sleep(0.8);
  }
}

function runStep(step, { axe, udid, bundleId }) {
  if (step.relaunch) {
    run('xcrun', ['simctl', 'terminate', udid, bundleId], { allowFail: true });
    sleep(1);
    run('xcrun', ['simctl', 'launch', udid, bundleId]);
  } else if (step.open) {
    run('xcrun', ['simctl', 'openurl', udid, step.open]);
  } else if (step.tap) {
    const args = ['tap', '--label', step.tap, '--wait-timeout', String(step.timeout ?? 20), '--udid', udid];
    if (step.type) args.push('--element-type', step.type);
    // A tap that lands while the app is still settling can be swallowed, so a
    // step that names what it opens (`until`) taps again until that appears.
    for (let attempt = 1; ; attempt++) {
      closeWarningToast(axe, udid);
      run(axe, args);
      if (!step.until || waitForLabel(axe, udid, step.until, 10)) break;
      if (attempt === 3) throw new Error(`tapping "${step.tap}" never showed "${step.until}"`);
    }
  } else if (step.tapAt) {
    closeWarningToast(axe, udid);
    run(axe, ['tap', '-x', String(step.tapAt[0]), '-y', String(step.tapAt[1]), '--udid', udid]);
  } else if (step.swipe) {
    const [sx, sy, ex, ey] = step.swipe;
    run(axe, ['swipe', '--start-x', String(sx), '--start-y', String(sy), '--end-x', String(ex), '--end-y', String(ey), '--duration', String(step.duration ?? 0.5), '--udid', udid]);
  }
  if (step.wait) sleep(step.wait);
}

export function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function capture(dir, names) {
  const manifest = loadManifest();
  const axe = findAxe();
  const udid = bootedUdid(manifest.simulator);
  const ctx = { axe, udid, bundleId: manifest.bundleId };
  mkdirSync(dir, { recursive: true });
  prepare(udid);
  const byName = new Map(manifest.screens.map((s) => [s.name, s]));
  let last = null;
  // A screen that continues from another (`from`) first replays that one's
  // steps when it was not the screen just captured, so any subset runs.
  const reach = (screen) => {
    if (screen.from && last !== screen.from) reach(byName.get(screen.from));
    for (const step of screen.steps) runStep(step, ctx);
    last = screen.name;
  };
  for (const screen of manifest.screens.filter((s) => !names.length || names.includes(s.name))) {
    reach(screen);
    closeWarningToast(axe, udid);
    sleep(manifest.settle ?? 1.5);
    const file = join(dir, `${screen.name}.png`);
    run('xcrun', ['simctl', 'io', udid, 'screenshot', '--type=png', file]);
    console.log(file);
  }
}

function diff(before, after, names) {
  const manifest = loadManifest();
  let failed = false;
  for (const screen of manifest.screens.filter((s) => !names.length || names.includes(s.name))) {
    const a = join(before, `${screen.name}.png`);
    const b = join(after, `${screen.name}.png`);
    if (!existsSync(a) || !existsSync(b)) {
      console.log(`${screen.name.padEnd(18)} missing ${existsSync(a) ? b : a}`);
      failed = true;
      continue;
    }
    const ia = decodePng(readFileSync(a));
    const ib = decodePng(readFileSync(b));
    const result = diffImages(ia, ib, { masks: screen.masks ?? [], scale: ia.width / manifest.pointWidth, tolerance: screen.tolerance?.channel ?? 0 });
    if (result.count) failed = true;
    const where = result.sizeMismatch ? 'size differs' : result.box ? `in x${result.box.x} y${result.box.y} w${result.box.w} h${result.box.h} (points)` : '';
    console.log(`${screen.name.padEnd(18)} ${result.count ? `${result.count} px differ ${where}` : 'identical'}${screen.masks?.length ? `  (masked: ${[...new Set(screen.masks.map((m) => m.why))].join('; ')})` : ''}`);
  }
  return failed ? 1 : 0;
}

function main([command, ...rest]) {
  if (command === 'capture' && rest[0]) return capture(resolve(rest[0]), rest.slice(1));
  if (command === 'diff' && rest[1]) process.exit(diff(resolve(rest[0]), resolve(rest[1]), rest.slice(2)));
  console.error('usage: shots.mjs capture <dir> [screen...] | diff <before-dir> <after-dir> [screen...]');
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
