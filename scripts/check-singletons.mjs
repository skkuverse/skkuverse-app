#!/usr/bin/env node
// Fails when a library the app must load exactly once is installed more than
// once. Run from anywhere after `yarn install`:
//
//   node scripts/check-singletons.mjs
//
// A second copy of a library that holds React context or global state splits
// that state with no error: a provider mounted from one copy is invisible to a
// hook imported from the other. On 10/5 the hot-updater CLI hoisted
// @tanstack/react-query 5.104.1 to the root while apps/mobile's ^5.95.2 kept a
// nested 5.95.2, so @skkuverse/shared's hooks and the app's QueryClientProvider
// read different contexts and a fresh install opened on "No QueryClient set".
//
// Two checks against the installed tree, which is what Metro bundles:
//   A. Every workspace that depends on a singleton resolves the same copy.
//   B. Each singleton has one physical copy anywhere under node_modules.
//
// Exit 0 when every singleton is single, 1 when one is not, 2 when the tree
// is not installed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A library belongs here when two installed copies break the app rather than
// just make it bigger: it holds React context, module-level state (a store, a
// client, a cache), or a native module or view that registers once per
// process. `@scope/*` covers every package in the scope. An entry that matches
// nothing installed fails the check, so a typo cannot switch a library off.
const SINGLETONS = [
  'react',
  'react-native',
  '@tanstack/react-query',
  '@tanstack/query-core',
  'zustand',
  'expo',
  'expo-modules-core',
  'expo-router',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native-screens',
  '@gorhom/bottom-sheet',
  'react-native-mmkv',
  'react-native-nitro-modules',
  '@hot-updater/react-native',
  '@react-native-firebase/*',
];

// A workspace shares its consumers' copy of anything it declares here.
// devDependencies are its own build and test tooling.
const RUNTIME_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const matches = (entry, name) =>
  entry.endsWith('/*') ? name.startsWith(entry.slice(0, -1)) : name === entry;
const isSingleton = (name) => SINGLETONS.some((entry) => matches(entry, name));
const rel = (p) => path.relative(ROOT, p) || '.';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return [];
    throw err;
  }
}

function versionOf(dir) {
  try {
    return readJson(path.join(dir, 'package.json')).version ?? '?';
  } catch {
    return '?';
  }
}

// The root manifest plus every `workspaces` member. Only `dir/*` patterns are
// expanded, which is all this repo uses; any other pattern stops the check
// rather than quietly leaving members out.
function loadWorkspaces() {
  const rootManifest = readJson(path.join(ROOT, 'package.json'));
  const patterns = Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces
    : rootManifest.workspaces?.packages ?? [];
  const workspaces = [{ dir: ROOT, label: 'root', manifest: rootManifest, member: false }];
  for (const pattern of patterns) {
    const parent = /^([^*]+)\/\*$/.exec(pattern)?.[1];
    if (!parent) throw new Error(`unsupported workspaces pattern "${pattern}"`);
    for (const entry of readDir(path.join(ROOT, parent))) {
      const dir = path.join(ROOT, parent, entry.name);
      if (!entry.isDirectory() || !fs.existsSync(path.join(dir, 'package.json'))) continue;
      workspaces.push({ dir, label: rel(dir), manifest: readJson(path.join(dir, 'package.json')), member: true });
    }
  }
  return workspaces;
}

// name -> [{ ws, field, range }], devDependencies included so the report can
// say how each workspace declares the package.
function collectDeclarations(workspaces) {
  const declarations = new Map();
  for (const ws of workspaces) {
    for (const field of [...RUNTIME_FIELDS, 'devDependencies']) {
      for (const [name, range] of Object.entries(ws.manifest[field] ?? {})) {
        if (!isSingleton(name)) continue;
        if (!declarations.has(name)) declarations.set(name, []);
        declarations.get(name).push({ ws, field, range });
      }
    }
  }
  return declarations;
}

// name -> [dir] for every physical copy, nested node_modules included.
// Symlinks are skipped: yarn links each workspace into the root node_modules,
// and every workspace's own node_modules is walked once, directly.
function collectCopies(workspaces) {
  const copies = new Map();
  const visit = (dir, name) => {
    if (isSingleton(name) && fs.existsSync(path.join(dir, 'package.json'))) {
      if (!copies.has(name)) copies.set(name, []);
      copies.get(name).push(dir);
    }
    walk(path.join(dir, 'node_modules'));
  };
  const walk = (nodeModules) => {
    for (const entry of readDir(nodeModules)) {
      if (entry.name.startsWith('.') || !entry.isDirectory()) continue;
      const dir = path.join(nodeModules, entry.name);
      if (!entry.name.startsWith('@')) {
        visit(dir, entry.name);
        continue;
      }
      for (const scoped of readDir(dir)) {
        if (scoped.isDirectory()) visit(path.join(dir, scoped.name), `${entry.name}/${scoped.name}`);
      }
    }
  };
  for (const ws of workspaces) walk(path.join(ws.dir, 'node_modules'));
  return copies;
}

// The copy Node would load for `name` from `dir`: the first node_modules/<name>
// walking up. Done by hand because some packages' `exports` hide package.json
// from require.resolve.
function resolveFrom(dir, name) {
  for (let d = dir; ; d = path.dirname(d)) {
    const candidate = path.join(d, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    if (path.dirname(d) === d) return null;
  }
}

// A copy directly in a workspace's own node_modules belongs to that workspace
// alone when it declares the package only in devDependencies: the workspace
// builds or tests with it and shares nothing through it. A web page a
// workspace builds into a string, with its own React, would be the case.
function devOnlyOwner(dir, name, workspaces) {
  return workspaces.find(
    (ws) =>
      ws.member &&
      dir === path.join(ws.dir, 'node_modules', name) &&
      ws.manifest.devDependencies?.[name] !== undefined &&
      RUNTIME_FIELDS.every((field) => ws.manifest[field]?.[name] === undefined),
  );
}

function checkPackage(name, copyDirs, declared, workspaces) {
  const copies = copyDirs.map((dir) => ({
    dir,
    version: versionOf(dir),
    owner: devOnlyOwner(dir, name, workspaces),
  }));
  const counted = copies.filter((copy) => !copy.owner);
  // A declared package that resolves to nothing is left to the bundler and
  // typecheck: yarn installs no peer dependency, and Metro's nodeModulesPaths
  // can still find a copy Node's lookup misses.
  const resolutions = declared
    .filter((d) => RUNTIME_FIELDS.includes(d.field))
    .map((d) => ({ ...d, real: resolveFrom(d.ws.dir, name) }))
    .filter((d) => d.real);
  const resolved = new Set(resolutions.map((d) => d.real));
  const problems = [];
  if (counted.length > 1) problems.push(`${counted.length} copies installed`);
  if (resolved.size > 1) problems.push(`workspaces resolve ${resolved.size} different copies`);
  return { name, copies, declared, resolutions, problems };
}

function printFailure({ name, copies, declared, resolutions, problems }) {
  console.error(`\n✗ ${name}: ${problems.join('; ')}`);
  console.error('  copies:');
  const versionWidth = Math.max(...copies.map((copy) => copy.version.length));
  for (const copy of copies) {
    const note = copy.owner ? `  (allowed: ${copy.owner.label} declares it only in devDependencies)` : '';
    console.error(`    ${copy.version.padEnd(versionWidth)}  ${rel(copy.dir)}${note}`);
  }
  console.error('  declared by:');
  if (declared.length === 0) console.error('    no workspace (only other packages depend on it)');
  const labelWidth = Math.max(0, ...declared.map((d) => d.ws.label.length));
  const fieldWidth = Math.max(0, ...declared.map((d) => d.field.length));
  for (const d of declared) {
    const real = resolutions.find((r) => r.ws === d.ws && r.field === d.field)?.real;
    const target = real ? `  -> ${versionOf(real)} ${rel(real)}` : '';
    console.error(`    ${d.ws.label.padEnd(labelWidth)}  ${d.field.padEnd(fieldWidth)}  ${d.range}${target}`);
  }
  console.error(
    `  fix: align the version ranges so yarn hoists one copy (a range inside another package needs a ` +
      `\`resolutions\` entry in the root package.json); \`yarn why ${name}\` shows what pulls in each copy.`,
  );
}

if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  console.error('check-singletons: node_modules is missing. Run `yarn install --frozen-lockfile` first.');
  process.exit(2);
}

const workspaces = loadWorkspaces();
const declarations = collectDeclarations(workspaces);
const copies = collectCopies(workspaces);
const names = [...new Set([...copies.keys(), ...declarations.keys()])].sort();
const failures = names
  .map((name) => checkPackage(name, copies.get(name) ?? [], declarations.get(name) ?? [], workspaces))
  .filter((result) => result.problems.length > 0);
const stale = SINGLETONS.filter((entry) => ![...copies.keys()].some((name) => matches(entry, name)));

if (failures.length === 0 && stale.length === 0) {
  console.log(`✓ ${names.length} singleton packages checked, one copy each`);
  process.exit(0);
}
for (const failure of failures) printFailure(failure);
if (stale.length > 0) {
  console.error(`\n✗ SINGLETONS in scripts/check-singletons.mjs lists packages nothing installs: ${stale.join(', ')}`);
  console.error('  fix: correct the name, or remove the entry if the app no longer uses the package.');
}
if (failures.length > 0) {
  console.error(`\ncheck-singletons: ${failures.length} of ${names.length} singleton packages have more than one copy.`);
}
process.exit(1);
