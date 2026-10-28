// File names under apps/mobile/src follow ADR 0020 D4. A React file (`.tsx`,
// or a `use*.ts` hook) is named after its main export. Every other `.ts` file
// is kebab-case `<base>.<role>.ts` from the closed role list, except under
// platform/: a wrapper is named by the resource it wraps, and its pure
// companions add a pure role (`analytics.rules.ts`). Under features/,
// a client, repository, service or store is named after its folder; a pure
// file may be named after its topic. Tests, assets and fixtures are not
// checked. Today's violations are on allowlists/file-names.json, which only
// shrinks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isUncheckedSource, ratchetAllowlist, repoFiles, repoRoot } from './ratchet.mjs';
import vocabulary from './vocabulary.cjs';

const { PURE_ROLES, ROLES, SINGLETON_ROLES } = vocabulary;
const SCOPE = 'apps/mobile/src/';
const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
const ROLE_FILE = new RegExp(`^${KEBAB}\\.(${ROLES.join('|')})\\.ts$`);
const PLATFORM_FILE = new RegExp(`^${KEBAB}(?:\\.(${PURE_ROLES.join('|')}))?\\.ts$`);
const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;
const HOOK = /^use[A-Z][A-Za-z0-9]*$/;

function exportsName(source, name) {
  const declared = new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|class|let)\\s+${name}\\b`);
  const listed = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
  return declared.test(source) || listed.test(source);
}

/** The reason a file name breaks D4, or null. `source` is the file's text. */
export function fileNameViolation(path, source) {
  const file = basename(path);
  if (file.endsWith('.tsx') || /^use[A-Z]/.test(file)) {
    const stem = file.replace(/\.(tsx|ts)$/, '');
    if (!COMPONENT.test(stem) && !HOOK.test(stem)) {
      return 'a React file is named PascalCase or useCamelCase after its main export';
    }
    if (!exportsName(source, stem)) return `a React file exports a binding named after it (${stem})`;
    return null;
  }
  if (path.startsWith(`${SCOPE}platform/`)) {
    return PLATFORM_FILE.test(file)
      ? null
      : `a platform file is a wrapper named by its resource, or a pure companion: <resource>[.${PURE_ROLES.join('|')}].ts`;
  }
  if (ROLE_FILE.test(file)) {
    const [base, role] = file.split('.');
    const folder = basename(dirname(path));
    if (path.startsWith(`${SCOPE}features/`) && SINGLETON_ROLES.includes(role) && base !== folder) {
      return `a ${role} file is named after its folder: ${folder}.${role}.ts`;
    }
    return null;
  }
  return `expected kebab-case <base>.<role>.ts with a role from: ${ROLES.join(', ')}`;
}

test('fileNameViolation accepts the vocabulary and rejects the rest', () => {
  // Arrange
  const cases = [
    ['apps/mobile/src/features/home/home.client.ts', '', false],
    ['apps/mobile/src/features/home/home.helpers.ts', '', true],
    ['apps/mobile/src/features/home/home.mapper.ts', '', true],
    ['apps/mobile/src/features/map/chips.rules.ts', '', false],
    ['apps/mobile/src/features/map/chips.client.ts', '', true],
    ['apps/mobile/src/features/bus/schedule/schedule.client.ts', '', false],
    ['apps/mobile/src/features/home/components/useBannerPage.ts', 'export function useBannerPage() {}', false],
    ['apps/mobile/src/features/home/components/banner-page.rules.ts', '', false],
    ['apps/mobile/src/features/home/components/bannerPage.constants.ts', '', true],
    ['apps/mobile/src/features/home/index.ts', '', true],
    ['apps/mobile/src/features/home/useHome.ts', 'export function useHome() {}', false],
    ['apps/mobile/src/features/home/useHome.ts', 'export function useOther() {}', true],
    ['apps/mobile/src/features/home/HomeScreen.tsx', 'export function HomeScreen() {}', false],
    ['apps/mobile/src/features/home/homeScreen.tsx', 'export function homeScreen() {}', true],
    ['apps/mobile/src/platform/os-badge.ts', '', false],
    ['apps/mobile/src/platform/osBadge.ts', '', true],
    ['apps/mobile/src/platform/analytics.rules.ts', '', false],
    ['apps/mobile/src/platform/analytics.client.ts', '', true],
  ];

  // Act
  const results = cases.map(([path, source]) => fileNameViolation(path, source) !== null);

  // Assert
  assert.deepEqual(results, cases.map(([, , violates]) => violates));
});

test('an unknown suffix names the allowed roles', () => {
  // Act
  const reason = fileNameViolation('apps/mobile/src/features/home/home.helpers.ts', '');

  // Assert
  assert.match(reason, /role from: service, client, repository/);
});

test('a data role under platform/ names the two allowed shapes', () => {
  // Act
  const reason = fileNameViolation('apps/mobile/src/platform/analytics.client.ts', '');

  // Assert
  assert.match(reason, /wrapper named by its resource, or a pure companion/);
});

test('every file under apps/mobile/src follows ADR 0020 D4, or is allowlisted', () => {
  // Arrange
  const files = repoFiles().filter((path) => path.startsWith(SCOPE) && !isUncheckedSource(path));

  // Act
  const reasons = new Map(
    files
      .map((path) => [path, fileNameViolation(path, readFileSync(join(repoRoot, path), 'utf8'))])
      .filter(([, reason]) => reason !== null),
  );
  const violations = [...reasons.keys()].sort();
  const errors = ratchetAllowlist('file-names', violations, (path) => reasons.get(path));

  // Assert
  assert.deepEqual(errors, [], errors.join('\n'));
});
