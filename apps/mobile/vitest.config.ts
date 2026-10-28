// vitest for apps/mobile (ADR 0020 D9): new `*.test.ts(x)` files run here,
// while the existing `*.test.mts` suites stay on node:test until their module
// migrates. The aliases mirror tsconfig.json's paths. Native modules the shared
// package loads at import (react-native-mmkv, react-native, expo-constants,
// expo-localization) are swapped for the small stand-ins in test-support/,
// since Node cannot load them; tests cover logic, never rendering.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  define: { __DEV__: 'false' },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: here('./src/$1') },
      { find: /^@skkuverse\/([^/]+)$/, replacement: here('../../packages/$1/src') },
      { find: /^react-native-mmkv$/, replacement: here('./test-support/react-native-mmkv.ts') },
      { find: /^react-native$/, replacement: here('./test-support/react-native.ts') },
      { find: /^expo-constants$/, replacement: here('./test-support/expo-constants.ts') },
      { find: /^expo-localization$/, replacement: here('./test-support/expo-localization.ts') },
    ],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test-support/**/*.test.ts'],
    environment: 'node',
  },
});
