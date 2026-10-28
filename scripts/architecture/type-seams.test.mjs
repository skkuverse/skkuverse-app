// A feature that knows another only through `import type` never names that feature's kinds at
// run time (ADR 0020 D3). Such a feature cannot import the other at run time (usually the
// other imports it, and feature-cycles forbids the loop), so it cannot ask the owner either;
// switching on the owner's `kind` literals makes it decide the owner's cases itself. That was
// map review F6: the map's reducer branched on transit's `bus_stop`, `subway_station` and `line`.
//
// A seam is a pair of features A → B where every import from B is type-only. Its kinds are the
// `kind` literals of the types A imports from B, resolved by the type checker through aliases,
// unions, intersections and B's other files; a type whose kinds cannot be resolved is reported,
// never skipped. A kind A's own `.types.ts` files write as a type is A's own and stays nameable
// (map's marker taps include `bus_stop`). A violation is a forbidden kind in a value position of
// any non-test file of A, `.types.ts` included. A type position (`Extract<K, 'line'>`) is a type,
// not a decision, and a table key, quoted or not, is not a literal. Today's violations are on
// allowlists/type-seams.json, which only shrinks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { FEATURES, featureOf, isTypeOnly, parse, resolveSpecifier, ts } from './imports.mjs';
import { isUncheckedSource, ratchetAllowlist, repoFiles, repoRoot } from './ratchet.mjs';

/** The names a declaration imports as types: all of them for `import type`, else the `type` specifiers. */
function typeImportNames(node) {
  const bindings = node.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  const all = node.importClause.isTypeOnly;
  return bindings.elements.filter((e) => all || e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text);
}

const ANY = ts.TypeFlags.Any | ts.TypeFlags.Unknown;

/**
 * A type checker over `sources` alone (plus TypeScript's own lib), so a kind is
 * resolved through aliases, unions, intersections, `Extract` and other files of
 * the owner. An import from outside `sources` resolves to nothing, which reads as
 * `any`; a `kind` that comes out `any` is unresolvable and reported, never skipped.
 */
function checkerFor(sources, roots) {
  const options = {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    baseUrl: repoRoot,
    paths: { '@/*': ['apps/mobile/src/*'] },
    types: [],
  };
  const host = ts.createCompilerHost(options, true);
  const isLib = (fileName) => fileName.startsWith(dirname(ts.getDefaultLibFilePath(options)));
  const repoPathOf = (fileName) => relative(repoRoot, fileName).split(sep).join('/');
  host.fileExists = (fileName) => sources.has(repoPathOf(fileName)) || (isLib(fileName) && ts.sys.fileExists(fileName));
  host.readFile = (fileName) => sources.get(repoPathOf(fileName)) ?? (isLib(fileName) ? ts.sys.readFile(fileName) : undefined);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version) => {
    const source = sources.get(repoPathOf(fileName));
    return source === undefined ? getSourceFile(fileName, version) : ts.createSourceFile(fileName, source, version, true);
  };
  const program = ts.createProgram(roots.map((path) => join(repoRoot, path)), options, host);
  return { program, checker: program.getTypeChecker() };
}

/**
 * The `kind` literals of the type `name` exported by `target`: the kind of each
 * member of a union, and of the type itself otherwise. Throws when they cannot
 * be resolved, so a seam is never skipped silently.
 */
function kindsOf({ program, checker }, target, name) {
  const file = program.getSourceFile(join(repoRoot, target));
  const exported = file && checker.getSymbolAtLocation(file)?.exports?.get(name);
  if (!exported) throw new Error(`exports no type named ${name}`);
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  if (!(symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Class | ts.SymbolFlags.Enum))) return new Set();
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  if (type.flags & ANY) throw new Error(`${name} is ${checker.typeToString(type)}`);
  const kinds = new Set();
  for (const member of type.isUnion() ? type.types : [type]) {
    if (member.flags & ANY) throw new Error(`a member of ${name} is ${checker.typeToString(member)}`);
    const kind = checker.getPropertyOfType(member, 'kind');
    if (!kind) continue;
    const kindType = checker.getNonNullableType(checker.getTypeOfSymbol(kind));
    if (kindType.flags & ANY) throw new Error(`a member of ${name} has a kind of ${checker.typeToString(kindType)}`);
    for (const literal of kindType.isUnion() ? kindType.types : [kindType]) {
      if (literal.isStringLiteral()) kinds.add(literal.value);
    }
  }
  return kinds;
}

/** The string literals a file writes as types, in any position: the kinds its own types declare. */
function typeLiterals(file) {
  const literals = new Set();
  const visit = (node) => {
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) literals.add(node.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return literals;
}

/** Each string literal in a value position: not a type, not a module specifier, not a property name. */
function valueLiterals(file) {
  const literals = [];
  const visit = (node) => {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    const isKey = node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node;
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isKey) literals.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return literals;
}

/**
 * The seam keys for a set of files: `sources` maps a repository path to its text. A key reads
 * `<file> names '<kind>', a kind of <feature>'s <Type>`, once per file and kind, or
 * `<owner file> <Type>: its kinds cannot be resolved (<why>)` for a type the check cannot read.
 */
export function typeSeamViolations(sources) {
  const exists = (path) => sources.has(path);
  const files = new Map([...sources].map(([path, source]) => [path, parse(path, source)]));
  /** `A>B` -> whether A imports B at run time */
  const runtime = new Map();
  /** `A>B` -> [{ target, name }] the types A imports from B */
  const typeImports = new Map();
  for (const [path, file] of files) {
    const from = featureOf(path);
    if (!from) continue;
    for (const node of file.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
      const target = resolveSpecifier(node.moduleSpecifier.text, path, exists);
      const to = target && featureOf(target);
      if (!to || to === from) continue;
      const pair = `${from}>${to}`;
      if (!isTypeOnly(node)) runtime.set(pair, true);
      if (ts.isImportDeclaration(node)) {
        for (const name of typeImportNames(node)) typeImports.set(pair, [...(typeImports.get(pair) ?? []), { target, name }]);
      }
    }
  }

  const seams = [...typeImports].filter(([pair]) => !runtime.get(pair));
  if (seams.length === 0) return [];
  const checker = checkerFor(sources, [...new Set(seams.flatMap(([, imported]) => imported.map((i) => i.target)))]);
  const keys = new Set();
  for (const [pair, imported] of seams) {
    const [from, to] = pair.split('>');
    const fromFiles = [...files].filter(([path]) => featureOf(path) === from);
    /** What the importer's own types declare is its own to name. */
    const own = new Set(fromFiles.filter(([path]) => path.endsWith('.types.ts')).flatMap(([, file]) => [...typeLiterals(file)]));
    /** kind -> the type that declares it */
    const kinds = new Map();
    for (const { target, name } of imported) {
      let declared;
      try {
        declared = kindsOf(checker, target, name);
      } catch (error) {
        keys.add(`${target} ${name}: its kinds cannot be resolved (${error.message})`);
        continue;
      }
      for (const kind of declared) if (!kinds.has(kind) && !own.has(kind)) kinds.set(kind, name);
    }
    for (const [path, file] of fromFiles) {
      for (const literal of valueLiterals(file)) {
        if (kinds.has(literal)) keys.add(`${path} names '${literal}', a kind of ${to}'s ${kinds.get(literal)}`);
      }
    }
  }
  return [...keys].sort();
}

const TRANSIT_TYPES = "export type TransitSheetRequest =\n  | { kind: 'line'; groupId: string }\n  | { kind: 'bus_stop'; stopId: string };\nexport type TransitItem = { kind: 'live' };\n";
const TRANSIT_SERVICE = "import { openSheet } from '@/features/map/map.service';\nexport const open = openSheet;\n";

test('typeSeamViolations finds a kind of a type-only import named at run time, and nothing else', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', TRANSIT_TYPES],
    ['apps/mobile/src/features/transit/transit.service.ts', TRANSIT_SERVICE],
    ['apps/mobile/src/features/map/map.service.ts', 'export const openSheet = 1;\n'],
    [
      'apps/mobile/src/features/map/map-task.rules.ts',
      "import type { TransitSheetRequest } from '@/features/transit/transit.types';\n" +
        "export const isStop = (r: { kind: string }) => r.kind === 'bus_stop';\n" +
        "export const live = 'live';\n",
    ],
  ]);

  // Act
  const keys = typeSeamViolations(sources);

  // Assert
  assert.deepEqual(keys, [
    "apps/mobile/src/features/map/map-task.rules.ts names 'bus_stop', a kind of transit's TransitSheetRequest",
  ]);
});

test('a type position and a table key are not a decision', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', TRANSIT_TYPES],
    [
      'apps/mobile/src/features/map/map-tabs.constants.ts',
      "import type { TransitSheetRequest } from '../transit/transit.types';\n" +
        "export const HOME_TAB = { line: 'transit', bus_stop: 'transit' } as const;\n" +
        "export type Fed = Extract<TransitSheetRequest['kind'], 'bus_stop'>;\n",
    ],
  ]);

  // Act & Assert
  assert.deepEqual(typeSeamViolations(sources), []);
});

test('a feature that imports the other at run time is not across a seam', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', TRANSIT_TYPES],
    ['apps/mobile/src/features/transit/transit.service.ts', 'export const pending = 1;\n'],
    [
      'apps/mobile/src/features/search/useSearch.ts',
      "import { pending } from '@/features/transit/transit.service';\n" +
        "import type { TransitSheetRequest } from '@/features/transit/transit.types';\n" +
        "export const k = 'bus_stop';\n",
    ],
  ]);

  // Act & Assert
  assert.deepEqual(typeSeamViolations(sources), []);
});

test('kinds resolve through aliases, unions and another file of the owner', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/stop.types.ts', "export type StopReq = { kind: 'bus_stop'; stopId: string };\n"],
    [
      'apps/mobile/src/features/transit/transit.types.ts',
      "import type { StopReq } from './stop.types';\ntype LineReq = { kind: 'line' };\nexport type TransitSheetRequest = LineReq | (StopReq & { source: string });\n",
    ],
    [
      'apps/mobile/src/features/map/map-task.rules.ts',
      "import type { TransitSheetRequest } from '@/features/transit/transit.types';\nexport const a = 'line';\nexport const b = 'bus_stop';\n",
    ],
  ]);

  // Act & Assert
  assert.deepEqual(typeSeamViolations(sources), [
    "apps/mobile/src/features/map/map-task.rules.ts names 'bus_stop', a kind of transit's TransitSheetRequest",
    "apps/mobile/src/features/map/map-task.rules.ts names 'line', a kind of transit's TransitSheetRequest",
  ]);
});

test('an imported type whose kinds cannot be resolved fails loudly rather than being skipped', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', "import type { Mystery } from 'somewhere-else';\nexport type TransitSheetRequest = Mystery;\n"],
    ['apps/mobile/src/features/map/map-task.rules.ts', "import type { TransitSheetRequest } from '@/features/transit/transit.types';\nexport const a = 1;\n"],
  ]);

  // Act
  const keys = typeSeamViolations(sources);

  // Assert
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^apps\/mobile\/src\/features\/transit\/transit\.types\.ts TransitSheetRequest: its kinds cannot be resolved/);
});

test("a value in the importer's .types.ts is checked like any other", () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', TRANSIT_TYPES],
    [
      'apps/mobile/src/features/map/sheet-stack.types.ts',
      "import type { TransitSheetRequest } from '@/features/transit/transit.types';\nexport const STOP = 'bus_stop';\n",
    ],
  ]);

  // Act & Assert
  assert.deepEqual(typeSeamViolations(sources), [
    "apps/mobile/src/features/map/sheet-stack.types.ts names 'bus_stop', a kind of transit's TransitSheetRequest",
  ]);
});

test("a kind the importer declares in its own types is its own to name", () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', TRANSIT_TYPES],
    ['apps/mobile/src/features/map/overlay.types.ts', "export type MarkerTap = { kind: 'bus_stop'; placeId: string } | { kind: 'event'; placeId: string };\n"],
    [
      'apps/mobile/src/features/map/map-task.rules.ts',
      "import type { TransitSheetRequest } from '@/features/transit/transit.types';\nexport const tap = 'bus_stop';\nexport const line = 'line';\n",
    ],
  ]);

  // Act & Assert
  assert.deepEqual(typeSeamViolations(sources), [
    "apps/mobile/src/features/map/map-task.rules.ts names 'line', a kind of transit's TransitSheetRequest",
  ]);
});

test('a quoted table key passes as an unquoted one does', () => {
  // Arrange
  const sources = new Map([
    ['apps/mobile/src/features/transit/transit.types.ts', TRANSIT_TYPES],
    [
      'apps/mobile/src/features/map/map-tabs.constants.ts',
      "import type { TransitSheetRequest } from '../transit/transit.types';\nexport const HOME_TAB = { 'line': 'transit', bus_stop: 'transit' } as const;\n",
    ],
  ]);

  // Act & Assert
  assert.deepEqual(typeSeamViolations(sources), []);
});

test('no feature names the kinds of a feature it knows only by type, or the file is allowlisted', () => {
  // Arrange
  const sources = new Map(
    repoFiles()
      .filter((path) => path.startsWith(FEATURES) && !isUncheckedSource(path))
      .filter((path) => existsSync(join(repoRoot, path)))
      .map((path) => [path, readFileSync(join(repoRoot, path), 'utf8')]),
  );

  // Act
  const errors = ratchetAllowlist('type-seams', typeSeamViolations(sources), () =>
    "a feature that may not import another at run time does not decide that feature's cases. Let the request carry what you need (its key, a table row keyed by kind), or ask the owner through the view table it supplies",
  );

  // Assert
  assert.deepEqual(errors, [], errors.join('\n'));
});
