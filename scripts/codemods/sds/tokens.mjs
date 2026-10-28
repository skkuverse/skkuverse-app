// The SDS token tables, read from their TypeScript source in
// packages/shared/src/tokens/ so the codemods never carry a copy of a value.
// Each file is transpiled to CommonJS in memory and evaluated; a relative
// import resolves to the sibling .ts file. Only the standalone token files
// (and semanticColors.ts, which imports colors.ts) are loaded, never one that
// imports react-native.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TOKENS = resolve(repoRoot, 'packages/shared/src/tokens');

const cache = new Map();

function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const source = readFileSync(path, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  });
  const module = { exports: {} };
  cache.set(path, module);
  const localRequire = (spec) => {
    if (!spec.startsWith('.')) throw new Error(`tokens.mjs: ${path} imports ${spec}; only relative token imports load`);
    return load(resolve(dirname(path), `${spec}.ts`));
  };
  new Function('exports', 'require', 'module', outputText)(module.exports, localRequire, module);
  return module.exports;
}

/** One token file's exports by its basename: `tokenFile('spacing').SdsSpacing`. */
export function tokenFile(name) {
  return load(resolve(TOKENS, `${name}.ts`));
}

/**
 * The tables the scanner, the mapping and the codemods read:
 * SdsColors (TDS names, light values), SdsPalette, the semantic role steps,
 * SdsSpacing, SdsRadius, SdsTypeScale and the SdsTypo style names.
 */
export function loadTokens() {
  const { SdsColors, SdsPalette } = tokenFile('colors');
  const { semanticColorSteps, SdsSemanticColors } = tokenFile('semanticColors');
  const { SdsSpacing } = tokenFile('spacing');
  const { SdsRadius } = tokenFile('radius');
  const { SdsTypeScale, SdsTypo } = tokenFile('typography');
  return { SdsColors, SdsPalette, semanticColorSteps, SdsSemanticColors, SdsSpacing, SdsRadius, SdsTypeScale, SdsTypo };
}
