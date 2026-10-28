import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaOf, checkFiles, formatReport, isCommentScoped } from './tree.mjs';

test('reads the app, its routes and the packages\' sources, and leaves out tests, fixtures, generated and vendored files', () => {
  // Arrange
  const vendored = new Set(['packages/shared/src/vendored.ts']);
  const cases = [
    ['apps/mobile/src/features/map/map.rules.ts', true],
    ['apps/mobile/src/features/map/MapHost.tsx', true],
    ['apps/mobile/app/(tabs)/_layout.tsx', true],
    ['packages/sds/src/components/Button.tsx', true],
    ['packages/shared/src/api/client.ts', true],
    ['apps/mobile/src/features/map/map.rules.test.ts', false],
    ['apps/mobile/src/features/map/map.rules.test.mts', false],
    ['packages/sds/src/components/Button.typetest.ts', false],
    ['apps/mobile/src/features/map/__fixtures__/config.ts', false],
    ['apps/mobile/src/features/map/__tests__/x.ts', false],
    ['apps/mobile/src/features/map/x.generated.ts', false],
    ['apps/mobile/src/types/env.d.ts', false],
    ['packages/shared/src/vendored.ts', false],
    ['apps/mobile/app.config.ts', false],
    ['scripts/architecture/ratchet.mjs', false],
    ['apps/mobile/src/features/map/config.json', false],
  ];

  // Act
  const scoped = cases.map(([path]) => [path, isCommentScoped(path, vendored)]);

  // Assert
  assert.deepEqual(scoped, cases);
});

test('names the area a file sits in', () => {
  // Act
  const areas = [
    'apps/mobile/src/features/map/map.rules.ts',
    'apps/mobile/src/platform/clock.ts',
    'apps/mobile/app/_layout.tsx',
    'packages/sds/src/components/Button.tsx',
  ].map(areaOf);

  // Assert
  assert.deepEqual(areas, ['features', 'platform', 'app', 'packages/sds']);
});

test('runs every rule over every file and reports by rule, file and line', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/platform/b.ts', '// Restates the code.\nconst a = 1;\n// --- Section ---'],
    ['apps/mobile/src/features/map/a.ts', '// WHY: fine.\nconst a = 1;'],
  ]);
  const ctx = { features: ['map'], exists: () => false, readDoc: () => null };

  // Act
  const violations = checkFiles([...sources.keys()], (file) => sources.get(file), ctx);

  // Assert
  assert.deepEqual(violations, [
    { rule: 'comment-tags', file: 'apps/mobile/src/platform/b.ts', line: 1, message: 'Restates the code.' },
    { rule: 'comment-tags', file: 'apps/mobile/src/platform/b.ts', line: 3, message: '--- Section ---' },
    { rule: 'section-comments', file: 'apps/mobile/src/platform/b.ts', line: 3, message: 'Section' },
  ]);
});

test('prints violations grouped by rule and file, then the totals by rule and by area', () => {
  // Arrange
  const violations = [
    { rule: 'comment-tags', file: 'apps/mobile/src/platform/b.ts', line: 1, message: 'Restates the code.' },
    { rule: 'comment-tags', file: 'packages/shared/src/c.ts', line: 4, message: 'Another.' },
    { rule: 'section-comments', file: 'apps/mobile/src/platform/b.ts', line: 3, message: 'Section' },
  ];

  // Act
  const report = formatReport(violations);

  // Assert
  assert.equal(
    report,
    [
      'comment-tags (2)',
      '  apps/mobile/src/platform/b.ts (1)',
      '    1: Restates the code.',
      '  packages/shared/src/c.ts (1)',
      '    4: Another.',
      'section-comments (1)',
      '  apps/mobile/src/platform/b.ts (1)',
      '    3: Section',
      '',
      'By rule:',
      '  comment-tags: 2',
      '  section-comments: 1',
      'By area:',
      '  platform: 2',
      '  packages/shared: 1',
      'Total: 3',
    ].join('\n'),
  );
});

test('prints a total of zero when nothing violates', () => {
  // Act & Assert
  assert.equal(formatReport([]), 'Total: 0');
});
