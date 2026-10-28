// Which app config carries the App Check debug tokens (app.config.ts `extra`). A dev server hands
// `extra` to anyone who can reach it, so none may carry a token, while the binary a native debug
// build embeds keeps both. Each command runs through `sh` with a stub `expo` that evaluates the
// config the way the real CLI does: it loads `.env*`, a native build runs expo-constants' build
// script as Xcode's script phase and Gradle's createExpoConfig task do, and every command but a
// `--no-bundler` build then starts Metro, which evaluates the config in its own process.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const MOBILE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { scripts } = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8'));
const BUILD_SCRIPT = join(
  dirname(createRequire(join(MOBILE, 'package.json')).resolve('expo-constants/package.json')),
  'scripts/getAppConfig.js',
);

const TOKENS = { FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS: 'ios-canary', FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID: 'android-canary' };
const EMBEDDED = { firebaseAppCheckDebugTokenIos: 'ios-canary', firebaseAppCheckDebugTokenAndroid: 'android-canary' };
const CLEARED = ['EAS_BUILD_PROFILE', 'RELEASE_CHANNEL', 'NODE_ENV', 'EXPO_NO_DOTENV'];

const work = mkdtempSync(join(tmpdir(), 'app-check-debug-token-'));
after(() => rmSync(work, { recursive: true, force: true }));
const bin = join(work, 'bin');
mkdirSync(bin);
writeFileSync(
  join(bin, 'expo'),
  `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const root = process.cwd();
const from = (id) => require(require.resolve(id, { paths: [root] }));
const [command, ...flags] = process.argv.slice(2);
process.env.NODE_ENV ||= 'development';
from('@expo/env').loadProjectEnv(process.env.DOTENV_DIR, { silent: true, mode: process.env.NODE_ENV, systemEnv: process.env });
const result = {};
if (command.startsWith('run:')) {
  const out = process.env.EXTRA_OUT + '.build';
  mkdirSync(out);
  const build = spawnSync(process.execPath, [process.env.BUILD_SCRIPT, root, out], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(1);
  result.embedded = JSON.parse(readFileSync(out + '/app.config', 'utf8')).extra;
}
if (!flags.includes('--no-bundler')) {
  result.served = from('expo/config').getConfig(root, { isPublicConfig: true, skipSDKVersionRequirement: true }).exp.extra;
}
writeFileSync(process.env.EXTRA_OUT, JSON.stringify(result));
`,
);
chmodSync(join(bin, 'expo'), 0o755);

let runs = 0;

/** An environment with `.env`'s tokens loaded and no shipping signal, plus `env`. */
function environment(env) {
  const base = { ...process.env, ...TOKENS };
  for (const name of CLEARED) delete base[name];
  return { ...base, ...env };
}

/** A fresh directory holding `files`, the `.env*` files a command loads. */
function dotenvDir(files) {
  const dir = join(work, `dotenv-${runs++}`);
  mkdirSync(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

/** The `extra` Metro serves and the `extra` the binary embeds when `command` runs. */
function extrasUnder(command, { env = {}, dotenv = {} } = {}) {
  const out = join(work, `extra-${runs++}.json`);
  const run = spawnSync('sh', ['-c', command], {
    cwd: MOBILE,
    env: environment({
      ...env,
      DOTENV_DIR: dotenvDir(dotenv),
      BUILD_SCRIPT,
      EXTRA_OUT: out,
      PATH: `${bin}:${process.env.PATH}`,
    }),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(readFileSync(out, 'utf8'));
}

/** The `extra` a native build by any route embeds: Xcode or Gradle running the build script. */
function embeddedByBuildScript(env = {}) {
  const out = join(work, `build-${runs++}`);
  mkdirSync(out);
  const run = spawnSync(process.execPath, [BUILD_SCRIPT, MOBILE, out], { cwd: MOBILE, env: environment(env), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(readFileSync(join(out, 'app.config'), 'utf8')).extra;
}

/** The debug tokens in `extra` that carry a value. */
function tokensIn(extra = {}) {
  return Object.fromEntries(Object.keys(EMBEDDED).filter((key) => extra[key]).map((key) => [key, extra[key]]));
}

/** The step of a script that runs `expo`, leaving out the patch check before it. */
function expoStep(name) {
  const step = scripts[name].split('&&').map((part) => part.trim()).find((part) => /(^|\s)expo\s/.test(part));
  assert.ok(step, `${name} runs expo`);
  return step;
}

const devServers = Object.keys(scripts).filter((name) => /(^|\s)expo start(\s|$)/.test(scripts[name]));
const nativeBuilds = Object.keys(scripts).filter((name) => /(^|\s)expo run:/.test(scripts[name]));

describe('a dev server serves no App Check debug token', () => {
  it('finds the dev server scripts', () => assert.ok(devServers.length >= 3, devServers.join(', ')));

  for (const name of devServers) {
    it(`yarn ${name}`, () => assert.deepEqual(tokensIn(extrasUnder(expoStep(name)).served), {}));
  }

  it('an ad-hoc expo start --lan', () => assert.deepEqual(tokensIn(extrasUnder('expo start --lan').served), {}));

  it('an expo start with the old opt-in in .env.local', () => {
    const { served } = extrasUnder('expo start --lan', { dotenv: { '.env.local': 'EMBED_APP_CHECK_DEBUG_TOKENS=1\n' } });
    assert.deepEqual(tokensIn(served), {});
  });

  for (const name of nativeBuilds) {
    it(`the Metro a yarn ${name} without --no-bundler starts`, () => {
      const { served } = extrasUnder(expoStep(name).replace(/\s--no-bundler(?=\s|$)/, ''));
      assert.ok(served, 'Metro started');
      assert.deepEqual(tokensIn(served), {});
    });
  }
});

describe('a native debug build embeds both tokens', () => {
  it('finds the native build scripts', () => assert.deepEqual(nativeBuilds.sort(), ['android', 'ios']));

  for (const name of nativeBuilds) {
    it(`yarn ${name}`, () => assert.deepEqual(tokensIn(extrasUnder(expoStep(name)).embedded), EMBEDDED));
  }

  it('a build from Xcode, Android Studio or npx expo run:*', () => assert.deepEqual(tokensIn(embeddedByBuildScript()), EMBEDDED));
});

describe('a shipping build embeds no token', () => {
  for (const env of [{ EAS_BUILD_PROFILE: 'production' }, { EAS_BUILD_PROFILE: 'development' }, { RELEASE_CHANNEL: 'beta' }]) {
    it(JSON.stringify(env), () => assert.deepEqual(tokensIn(embeddedByBuildScript(env)), {}));
  }
});
