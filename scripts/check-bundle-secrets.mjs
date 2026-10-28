#!/usr/bin/env node
// Fails when the contents of a .env file in apps/mobile reach a JS bundle.
// Run from anywhere after `yarn install`:
//
//   node scripts/check-bundle-secrets.mjs
//
// In development Expo's virtual env module reads the project root through
// `require.context(projectRoot, false, /^\.\/\.env/)` (@expo/metro-config's
// transform worker). Only the standard names go through the dotenv parser that
// drops non-public keys; any other `.env*` name Metro watches would be
// bundled verbatim, secrets included. apps/mobile/metro.config.js blocks every
// .env file from Metro.
//
// The check writes a canary file under each .env name that does not exist yet,
// bundles iOS in development and in production mode, and searches the output
// for each canary's key and value. It never overwrites or deletes a file it did
// not write, so a real .env or .env.ota.local is left as it is (that name is
// then checked through `.env.leakcheck.local`, which is caught by the same
// rule). It prints counts and file names, never bundle text.
//
// Exit 0 when no canary reached a bundle, 1 when one did, 2 when a bundle
// could not be built.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = path.join(ROOT, 'apps/mobile');

// The standard names, plus names outside the dotenv parser's list whose last
// extension Metro watches (`watcher.additionalExts`: env, local, development).
const NAMES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
  '.env.ota.local',
  '.env.leakcheck.local',
  '.env.leakcheck.development',
  '.env.leakcheck.env',
];
const KEY = 'SKKUVERSE_BUNDLE_LEAK_CANARY';

const nonce = crypto.randomBytes(8).toString('hex');
const canaries = [];
for (const [i, name] of NAMES.entries()) {
  const file = path.join(MOBILE, name);
  const value = `canary${nonce}n${i}`;
  try {
    fs.writeFileSync(file, `${KEY}=${value}\n`, { flag: 'wx' });
    canaries.push({ name, file, value });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`skip ${name}: already exists, left untouched`);
  }
}

function removeCanaries() {
  for (const { file } of canaries) fs.rmSync(file, { force: true });
}
process.on('exit', removeCanaries);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(130));
}

function bundleFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(js|hbc|map)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

let leaked = false;
for (const mode of ['development', 'production']) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-secrets-'));
  try {
    const args = ['expo', 'export', '--platform', 'ios', '--clear', '--output-dir', out];
    if (mode === 'development') args.push('--dev');
    const result = spawnSync('npx', args, {
      cwd: MOBILE,
      env: { ...process.env, CI: '1' },
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      console.error(`${mode}: expo export exited ${result.status}`);
      console.error(`${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-20).join('\n'));
      process.exit(2);
    }
    const files = bundleFiles(out);
    if (files.length === 0) {
      console.error(`${mode}: expo export wrote no bundle to ${out}`);
      process.exit(2);
    }
    const text = files.map((file) => fs.readFileSync(file, 'latin1')).join('\n');
    const hits = canaries.filter(({ value }) => text.includes(value)).map(({ name }) => name);
    const keyHits = text.split(KEY).length - 1;
    if (hits.length > 0 || keyHits > 0) {
      leaked = true;
      console.error(
        `${mode}: .env contents reached the bundle. Values from: ${hits.join(', ') || 'none'}; key name ${keyHits} time(s).`,
      );
    } else {
      console.log(`${mode}: ${canaries.length} canary .env files, 0 in ${files.length} bundle file(s)`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

if (leaked) {
  console.error(
    'A .env file was bundled. Keep the .env rule in apps/mobile/metro.config.js resolver.blockList.',
  );
  process.exit(1);
}
