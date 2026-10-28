// The release gates are where the one list says, no product feature reads the
// prerelease rule around it, and a store build has no way into the 이번 주
// 캠퍼스 더보기 page.
//
// `PRERELEASE_GATES` (apps/mobile/src/platform/ota.rules.ts) names what a store
// build leaves out, and every site reads `isGateOpen('<gate>')`, so a gate with
// no site is a list that lies. The 더보기 page's route redirects home on a store
// build, but that is a guard; the rule is that nothing a store build mounts
// links to it. Its only link is `openThisWeekPage`, reached from the feed's
// view model alone, whose sheet mounts only behind the `thisWeekSheet` gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['apps/mobile/src', 'apps/mobile/app', 'packages'];
const THIS_WEEK = 'apps/mobile/src/features/map/this-week';

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    // Tests drive the code under test however they like; they ship nothing.
    if (/\.test\.m?ts$/.test(entry.name)) return [];
    return /\.(tsx?|mts)$/.test(entry.name) ? [path] : [];
  });
}

/** Source with its comments blanked, so a doc comment naming the route is not a link to it. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const sources = new Map(
  SOURCE_DIRS.flatMap((dir) => sourceFiles(join(root, dir))).map((path) => [relative(root, path), code(readFileSync(path, 'utf8'))]),
);

/** The repository paths whose source matches `pattern`, sorted. */
function filesMatching(pattern) {
  return [...sources].filter(([, source]) => pattern.test(source)).map(([path]) => path).sort();
}

const gates = [...readFileSync(join(root, 'apps/mobile/src/platform/ota.rules.ts'), 'utf8')
  .match(/PRERELEASE_GATES = \[([^\]]*)\]/)[1]
  .matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);

test('the gate list is read from ota.rules.ts', () => {
  assert.ok(gates.length > 0);
});

test('every listed gate has at least one isGateOpen site', () => {
  for (const gate of gates) {
    assert.notDeepEqual(filesMatching(new RegExp(`isGateOpen\\('${gate}'\\)`)), [], gate);
  }
});

test('a product feature reads a named gate; only developer tooling reads isPrereleaseBuild directly', () => {
  assert.deepEqual(filesMatching(/\bisPrereleaseBuild\(\)/), [
    'apps/mobile/src/features/settings/SettingsScreen.tsx',
    'apps/mobile/src/platform/ota.ts',
  ]);
});

test('only the 더보기 opener names the /this-week route, beside the analytics screen-name table', () => {
  assert.deepEqual(filesMatching(/['"`]\/this-week['"`?]/), [
    'apps/mobile/src/bootstrap/screen-names.rules.ts',
    `${THIS_WEEK}/this-week.service.ts`,
  ]);
});

test('the opener is reached from the feed view model alone, which only the gated sheet mounts', () => {
  assert.deepEqual(filesMatching(/\bopenThisWeekPage\b/), [`${THIS_WEEK}/this-week.service.ts`, `${THIS_WEEK}/useThisWeek.ts`]);
  assert.deepEqual(filesMatching(/\buseThisWeek\(/), [`${THIS_WEEK}/components/ThisWeekSheet.tsx`, `${THIS_WEEK}/useThisWeek.ts`]);
  assert.deepEqual(filesMatching(/<ThisWeekSheet\b/), [`${THIS_WEEK}/ThisWeekMapTab.tsx`]);
  assert.match(sources.get(`${THIS_WEEK}/ThisWeekMapTab.tsx`), /isGateOpen\('thisWeekSheet'\)/);
});

test('the 더보기 route reads its own gate, so a link from the server lands on home', () => {
  assert.match(sources.get('apps/mobile/app/this-week.tsx'), /isGateOpen\('thisWeekPage'\)/);
});
