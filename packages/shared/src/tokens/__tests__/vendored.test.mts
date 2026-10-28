import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The token files the umbrella's design.* contracts copy byte for byte into
// skkuverse-web and the mini-app repository. The source of truth is the umbrella's
// contracts/manifest.json; the list is repeated here rather than scanned, so a
// token file no contract copies (fontFace.ts, textStyles.ts) may import.
//
// A .mts file, which tsc skips (packages/shared/tsconfig.json) as it does the
// sds tests: it reads files through node:fs, and the shared
// program carries no Node types because the package runs on React Native.
const VENDORED = ['colors.ts', 'typography.ts', 'spacing.ts', 'radius.ts'];

const MODULE_REFERENCES = [
  // import x from 'y', import type { x } from 'y', import 'y', import x = require('y')
  /^\s*import(?:\s|\{|\*|['"])[^;\n]*/gm,
  // export { x } from 'y', export type { x } from 'y', export * (as ns) from 'y'
  /^\s*export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"][^'"]*['"]/gm,
  /\bimport\s*\([^)]*\)/g,
  /\brequire\s*\([^)]*\)/g,
];

/** The import and re-export statements in `source`, comments aside. */
function moduleReferences(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return MODULE_REFERENCES.flatMap((pattern) =>
    [...code.matchAll(pattern)].map((match) => match[0].trim().replace(/\s+/g, ' ')),
  );
}

describe('vendored token files', () => {
  it.each(VENDORED)('%s imports and re-exports nothing', (file) => {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    expect(
      moduleReferences(source),
      `${file} is copied byte for byte into skkuverse-web and the mini-app repository, so it must stay standalone`,
    ).toEqual([]);
  });

  // Guards the scan itself, so the files above cannot pass by matching nothing.
  it('finds every form of import and re-export, and none in a comment', () => {
    const found = moduleReferences(
      [
        "import { Platform } from 'react-native';",
        "import type { FontWeightValue } from './fontFace';",
        "import './side-effect';",
        "export { wantedSans } from './textStyles';",
        "export * from './colors';",
        "const lazy = () => import('./lazy');",
        "const fs = require('fs');",
        "// import { Commented } from 'out';",
        "/** import { Doc } from 'out'; */",
        "export const SdsSpacing = { x1: 4 };",
      ].join('\n'),
    );
    expect(found).toEqual([
      "import { Platform } from 'react-native'",
      "import type { FontWeightValue } from './fontFace'",
      "import './side-effect'",
      "export { wantedSans } from './textStyles'",
      "export * from './colors'",
      "import('./lazy')",
      "require('fs')",
    ]);
  });
});
