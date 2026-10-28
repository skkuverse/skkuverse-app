import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuresOf, isSharedLayer, sharedCommentViolations } from './shared.mjs';

const FEATURES = ['ads', 'campus-routes', 'home', 'map', 'notices', 'web'];
const ctx = { features: FEATURES };
const messages = (file, source) => sharedCommentViolations(file, source, ctx).map((v) => v.message);

test('finds the features: the folders under apps/mobile/src/features', () => {
  // Arrange
  const files = [
    'apps/mobile/src/features/map/map.service.ts',
    'apps/mobile/src/features/map/sheet/Sheet.tsx',
    'apps/mobile/src/features/campus-routes/useCampusRoutes.ts',
    'apps/mobile/src/platform/clock.ts',
    'packages/shared/src/web/x.ts',
  ];

  // Act & Assert
  assert.deepEqual(featuresOf(files), ['campus-routes', 'map']);
});

test('the shared layers are the packages, platform and components', () => {
  // Act
  const shared = [
    'packages/shared/src/api/client.ts',
    'packages/sds/src/components/Button.tsx',
    'apps/mobile/src/platform/clock.ts',
    'apps/mobile/src/components/LoopingPager.tsx',
    'apps/mobile/src/features/map/map.service.ts',
    'apps/mobile/src/bootstrap/InitGate.tsx',
    'apps/mobile/app/_layout.tsx',
  ].map(isSharedLayer);

  // Assert
  assert.deepEqual(shared, [true, true, true, true, false, false, false]);
});

test('flags a feature path, file or hook in a shared-layer comment', () => {
  // Arrange
  const source = [
    '// WHY: features/map/ reads it, and so does ../notices/cache.',
    'const a = 1;',
    '/** QUIRK(ios): useMapHost and useCampusRoutesSheet need it, as web-feed.service.ts says. */',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(sharedCommentViolations('apps/mobile/src/platform/x.ts', source, ctx), [
    { line: 1, message: 'features/map/' },
    { line: 1, message: '../notices/' },
    { line: 3, message: 'useMapHost' },
    { line: 3, message: 'useCampusRoutesSheet' },
    { line: 3, message: 'web-feed.service.ts' },
  ]);
});

test('allows the words in prose, platform names, longer names and code', () => {
  // Arrange
  const source = [
    '// WHY: the map and the notices tab are product words, as in sitemap/ or campus-map/.',
    '// QUIRK(rn): WebView, MapView and a Map keep their names; useMap is no feature hook.',
    '// CONTRACT(skkuverse-server): it serves /ui/home/transitlist (skkuverse-server/src/ui/ui.controller.ts).',
    '// WHY: a path inside another folder, packages/shared/src/map/x, is not a feature.',
    '// WHY: the platform ads.ts wrapper is this layer\'s own file.',
    'const p = "features/map/x.ts";',
  ].join('\n');

  // Act & Assert
  assert.deepEqual(messages('packages/shared/src/x.ts', source), []);
});

test('checks only the shared layers', () => {
  // Arrange
  const source = '// WHY: features/map/ reads it.';

  // Act
  const checked = [
    'apps/mobile/src/features/notices/x.ts',
    'apps/mobile/src/bootstrap/x.ts',
    'apps/mobile/src/components/x.tsx',
  ].map((file) => messages(file, source));

  // Assert
  assert.deepEqual(checked, [[], [], ['features/map/']]);
});
