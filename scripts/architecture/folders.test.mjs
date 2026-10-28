// Folders follow ADR 0020 D2:
//   folder-roles   a folder under features/ holds at most one client,
//                  repository, service and store (pure roles repeat by topic),
//                  and a components/ folder holds only .tsx files, use* hooks
//                  and topic-named .rules and .constants;
//   folder-names   no folder under features/ is named after a code type;
//   feature-depth  a sub-feature is one level deep: no role file, hook or .tsx
//                  sits two folders below a feature outside components/;
//   top-level      apps/mobile/src holds only features, components, platform,
//                  bootstrap and dev;
//   shared-domains packages/shared/src accepts new files only in its shared
//                  folders, so domain code stops growing there; the package
//                  entry its package.json names is the one root file.
// Each rule keeps its own allowlist under allowlists/, which only shrinks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isUncheckedSource, ratchetAllowlist, repoFiles, repoRoot } from './ratchet.mjs';
import vocabulary from './vocabulary.cjs';

const { BANNED_FOLDERS, COMPONENT_PURE_ROLES, HOOK_FILE, ROLES, SINGLETON_ROLES, roleFile } = vocabulary;

const MOBILE = 'apps/mobile/src/';
const SHARED = 'packages/shared/src/';
export const TOP_LEVEL = ['features', 'components', 'platform', 'bootstrap', 'dev'];
export const SHARED_FOLDERS = ['api', 'i18n', 'tokens', 'schema', 'utils', 'time', 'store'];
const SHARED_ENTRY = `packages/shared/${JSON.parse(readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8')).main}`;
const SINGLETON_ROLE_FILE = roleFile(SINGLETON_ROLES);
const COMPONENT_PURE_FILE = roleFile(COMPONENT_PURE_ROLES);

/** Every data, service or store file after the first of its role in the same folder, and every file in a components/ folder that is not a .tsx, a use* hook, a .rules or a .constants. */
export function folderRoleViolations(paths) {
  const seen = new Map();
  const out = [];
  for (const path of [...paths].sort()) {
    if (!path.startsWith(`${MOBILE}features/`)) continue;
    const dir = dirname(path);
    if (basename(dir) === 'components' || dir.includes('/components/')) {
      if (!path.endsWith('.tsx') && !HOOK_FILE.test(basename(path)) && !COMPONENT_PURE_FILE.test(path)) out.push(path);
      continue;
    }
    const role = SINGLETON_ROLE_FILE.exec(path)?.[1];
    if (!role) continue;
    const key = `${dir} ${role}`;
    if (seen.has(key)) out.push(path);
    else seen.set(key, path);
  }
  return out;
}

/** Every file inside a folder under features/ that is named after a code type. */
export function folderNameViolations(paths) {
  return paths
    .filter((path) => path.startsWith(`${MOBILE}features/`))
    .filter((path) => dirname(path).split('/').some((part) => BANNED_FOLDERS.includes(part)))
    .sort();
}

const ROLE_FILE = roleFile(ROLES);

/**
 * Every role file, hook or `.tsx` two or more folders below a feature, counting
 * only the folders above its first components/ (private at any depth, D3).
 */
export function featureDepthViolations(paths) {
  return paths
    .filter((path) => path.startsWith(`${MOBILE}features/`))
    .filter((path) => {
      const file = basename(path);
      return file.endsWith('.tsx') || HOOK_FILE.test(file) || ROLE_FILE.test(file);
    })
    .filter((path) => {
      const folders = path.slice(`${MOBILE}features/`.length).split('/').slice(1, -1);
      const end = folders.indexOf('components');
      return (end === -1 ? folders : folders.slice(0, end)).length >= 2;
    })
    .sort();
}

/** Every file under apps/mobile/src outside the allowed top-level folders. */
export function topLevelViolations(paths) {
  return paths
    .filter((path) => path.startsWith(MOBILE))
    .filter((path) => {
      const rest = path.slice(MOBILE.length).split('/');
      return rest.length === 1 || !TOP_LEVEL.includes(rest[0]);
    })
    .sort();
}

/** Every file under packages/shared/src outside its shared folders, root files included except the package entry. */
export function sharedDomainViolations(paths) {
  return paths
    .filter((path) => path.startsWith(SHARED) && path !== SHARED_ENTRY)
    .filter((path) => {
      const rest = path.slice(SHARED.length).split('/');
      return rest.length === 1 || !SHARED_FOLDERS.includes(rest[0]);
    })
    .sort();
}

test('a second repository in one folder is a violation; components, private hooks and topic rules are not', () => {
  // Arrange
  const paths = [
    'apps/mobile/src/features/home/home.repository.ts',
    'apps/mobile/src/features/home/banner.repository.ts',
    'apps/mobile/src/features/home/home.rules.ts',
    'apps/mobile/src/features/home/hall.rules.ts',
    'apps/mobile/src/features/home/components/A.tsx',
    'apps/mobile/src/features/home/components/B.tsx',
    'apps/mobile/src/features/home/components/useBannerPage.ts',
    'apps/mobile/src/features/home/components/banner.rules.ts',
    'apps/mobile/src/features/home/components/banner.constants.ts',
    'apps/mobile/src/features/home/components/banner.client.ts',
    'apps/mobile/src/features/home/components/banner.schema.ts',
    'apps/mobile/src/features/home/components/helper.ts',
    'apps/mobile/src/features/home/schedule/schedule.repository.ts',
  ];

  // Act
  const violations = folderRoleViolations(paths);

  // Assert
  assert.deepEqual(violations, [
    'apps/mobile/src/features/home/components/banner.client.ts',
    'apps/mobile/src/features/home/components/banner.schema.ts',
    'apps/mobile/src/features/home/components/helper.ts',
    'apps/mobile/src/features/home/home.repository.ts',
  ]);
});

test('a hooks/ folder inside a feature is a violation; a sub-feature folder is not', () => {
  // Arrange
  const paths = ['apps/mobile/src/features/home/hooks/useX.ts', 'apps/mobile/src/features/bus/schedule/useSchedule.ts'];

  // Act
  const violations = folderNameViolations(paths);

  // Assert
  assert.deepEqual(violations, ['apps/mobile/src/features/home/hooks/useX.ts']);
});

test('only the five top-level folders are allowed under apps/mobile/src', () => {
  // Arrange
  const paths = [
    'apps/mobile/src/features/home/useHome.ts',
    'apps/mobile/src/platform/storage.ts',
    'apps/mobile/src/services/analytics.ts',
    'apps/mobile/src/loose.ts',
  ];

  // Act
  const violations = topLevelViolations(paths);

  // Assert
  assert.deepEqual(violations, ['apps/mobile/src/loose.ts', 'apps/mobile/src/services/analytics.ts']);
});

test('a file in a shared domain folder or another root file is a violation; one in a shared folder and the package entry are not', () => {
  // Arrange
  const paths = [
    'packages/shared/src/home/schema.ts',
    'packages/shared/src/schema/tolerant.ts',
    'packages/shared/src/index.ts',
    'packages/shared/src/loose.ts',
  ];

  // Act
  const violations = sharedDomainViolations(paths);

  // Assert
  assert.deepEqual(violations, ['packages/shared/src/home/schema.ts', 'packages/shared/src/loose.ts']);
});

test('a sub-sub-feature holding a role file, hook or .tsx is a violation; components/ and a sub-feature are not', () => {
  // Arrange
  const paths = [
    'apps/mobile/src/features/games/host/stage/PauseCard.tsx',
    'apps/mobile/src/features/games/host/stage/stage.rules.ts',
    'apps/mobile/src/features/games/host/stage/useStage.ts',
    'apps/mobile/src/features/games/host/stage/notes.ts',
    'apps/mobile/src/features/games/host/stage/image.png',
    'apps/mobile/src/features/games/host/GameScreen.tsx',
    'apps/mobile/src/features/games/host/components/Card.tsx',
    'apps/mobile/src/features/games/host/components/deep/Row.tsx',
    'apps/mobile/src/features/games/components/deep/deeper/Row.tsx',
    'apps/mobile/src/components/previews/deep/Preview.tsx',
  ];

  // Act
  const violations = featureDepthViolations(paths);

  // Assert
  assert.deepEqual(violations, [
    'apps/mobile/src/features/games/host/stage/PauseCard.tsx',
    'apps/mobile/src/features/games/host/stage/stage.rules.ts',
    'apps/mobile/src/features/games/host/stage/useStage.ts',
  ]);
});

test('every folder follows ADR 0020 D2, or is allowlisted', () => {
  // Arrange
  const files = repoFiles().filter((path) => !isUncheckedSource(path) && !path.includes('/__tests__/'));

  // Act
  const errors = [
    ...ratchetAllowlist('folder-roles', folderRoleViolations(files)),
    ...ratchetAllowlist('folder-names', folderNameViolations(files)),
    ...ratchetAllowlist('feature-depth', featureDepthViolations(files)),
    ...ratchetAllowlist('top-level', topLevelViolations(files)),
    ...ratchetAllowlist('shared-domains', sharedDomainViolations(files)),
  ];

  // Assert
  assert.deepEqual(errors, [], errors.join('\n'));
});
