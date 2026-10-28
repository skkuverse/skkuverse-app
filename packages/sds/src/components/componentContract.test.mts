/**
 * The invariants every SDS component keeps, read off the source tree.
 *
 * - A component's styles come from a recipe (SDS.md "Recipes", ADR 0014).
 *   The components still styled by a StyleSheet are listed below, and the
 *   list only shrinks: a listed component that stops styling with a sheet
 *   fails until its entry is removed.
 * - Every recipe module has its `node --test` sibling, which is what makes
 *   `sds/recipe-type-imports` load-bearing: a value import breaks that test.
 * - The SDS state catalog (apps/mobile/src/dev/sds-states) is the one
 *   catalog: it renders every exported component, and every recipe's variant
 *   map, so a new component, variant or tone has a place to be looked at.
 * - Every exported component has an importer in the app outside the
 *   catalog. One nothing uses is deleted, not exported (git keeps it).
 *
 * NOTE: packages/sds runs `node --test`; this file reads source text only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPONENTS = dirname(fileURLToPath(import.meta.url));
const APP = join(COMPONENTS, '../../../../apps/mobile');
const CATALOG = join(APP, 'src/dev/sds-states');

/**
 * Components still styled by a StyleSheet (`StyleSheet.create` or
 * `createThemedStyles`). Entries may only be removed: a component that moves
 * onto `createRecipe` leaves the list, and a new component starts on a recipe.
 */
const NOT_YET_ON_RECIPE: ReadonlySet<string> = new Set([
  'accordion-list',
  'badge-nav-row',
  'dialog',
  'fixed-bottom-cta',
  'glass',
  'list-header',
  'loader',
  'pressable',
  'search-field',
  'sheet',
  'switch',
  'toast',
  'txt',
]);

const componentDirs = readdirSync(COMPONENTS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/** A directory's component files: the capitalised `.tsx` modules. */
function componentSources(dir: string): string {
  return readdirSync(join(COMPONENTS, dir))
    .filter((file) => /^[A-Z].*\.tsx$/.test(file) && !file.includes('typetest'))
    .map((file) => readFileSync(join(COMPONENTS, dir, file), 'utf8'))
    .join('\n');
}

type Styling = 'recipe' | 'sheet' | 'none';

function stylingOf(dir: string): Styling {
  const src = componentSources(dir);
  if (/\bcreateRecipe\(/.test(src)) return 'recipe';
  if (/\bStyleSheet\.create\(|\bcreateThemedStyles\(/.test(src)) return 'sheet';
  return 'none';
}

describe('every SDS component styles through a recipe', () => {
  for (const dir of componentDirs) {
    it(dir, () => {
      const styling = stylingOf(dir);
      if (styling === 'sheet') {
        assert.ok(
          NOT_YET_ON_RECIPE.has(dir),
          `${dir} styles with a StyleSheet: move it onto createRecipe (SDS.md "Recipes")`,
        );
      } else {
        assert.ok(
          !NOT_YET_ON_RECIPE.has(dir),
          `${dir} no longer styles with a StyleSheet: remove its NOT_YET_ON_RECIPE entry`,
        );
      }
    });
  }

  it('lists only components that exist', () => {
    const stale = [...NOT_YET_ON_RECIPE].filter((dir) => !componentDirs.includes(dir));
    assert.deepEqual(stale, [], `remove the NOT_YET_ON_RECIPE entries for deleted components`);
  });
});

describe('every recipe module has its test', () => {
  const recipes = componentDirs.flatMap((dir) =>
    readdirSync(join(COMPONENTS, dir))
      .filter((file) => /Recipe\.ts$/.test(file))
      .map((file) => ({ dir, file })),
  );

  it('finds the recipes', () => {
    assert.ok(recipes.length > 0);
  });

  for (const { dir, file } of recipes) {
    const sibling = file.replace(/\.ts$/, '.test.mts');
    it(`${dir}/${file}`, () => {
      assert.ok(existsSync(join(COMPONENTS, dir, sibling)), `${dir}/${file} has no ${sibling} beside it`);
    });
  }
});

/** The catalog's source, every file of it, its components/ folder included. */
function catalogSource(): string {
  return readdirSync(CATALOG, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => readFileSync(join(CATALOG, file), 'utf8'))
    .join('\n');
}

/**
 * Whether the catalog renders a component: as an element (`<Badge`), through
 * its namespace (`Skeleton.Animate`, `Checkbox.Line`), or, for a part a
 * namespace also exports on its own (`ChipButton`), as that namespace's
 * member (`Chip.Button`).
 */
export function catalogRenders(name: string, siblings: readonly string[], catalog: string): boolean {
  if (new RegExp(`<${name}\\b|\\b${name}\\.[A-Z]\\w*`).test(catalog)) return true;
  return siblings.some((namespace) => {
    if (namespace === name || !name.startsWith(namespace)) return false;
    const member = name.slice(namespace.length);
    return /^[A-Z]/.test(member) && new RegExp(`\\b${namespace}\\.${member}\\b`).test(catalog);
  });
}

describe('the state catalog renders every recipe from its variant map', () => {
  const catalog = catalogSource();
  const variantMaps = componentDirs.flatMap((dir) => {
    const match = /export const (\w+VariantMap)\s*=\s*\w+\.variantMap\b/.exec(componentSources(dir));
    return match ? [{ dir, name: match[1] }] : [];
  });

  it('finds the variant maps', () => {
    assert.ok(variantMaps.length > 0);
  });

  for (const { dir, name } of variantMaps) {
    it(`${dir} (${name})`, () => {
      assert.match(
        catalog,
        new RegExp(`\\b${name}\\b`),
        `${dir}: the state catalog does not render ${name}. Add a section to apps/mobile/src/dev/sds-states laid out from it`,
      );
    });
  }
});

describe('the state catalog renders every exported component', () => {
  const catalog = catalogSource();
  const barrel = readFileSync(join(COMPONENTS, 'index.ts'), 'utf8');
  const exported = [...barrel.matchAll(/export \* from '\.\/([\w-]+)'/g)].map((match) => match[1]);

  it('reads a namespace member as its part', () => {
    const sample = '<Chip.Toggle><Chip.Label>x</Chip.Label></Chip.Toggle>; <Skeleton.Animate />';
    assert.equal(catalogRenders('ChipToggle', ['Chip', 'ChipToggle'], sample), true);
    assert.equal(catalogRenders('Chip', ['Chip'], sample), true);
    assert.equal(catalogRenders('Skeleton', ['Skeleton'], sample), true);
    assert.equal(catalogRenders('ChipRadioRoot', ['Chip', 'ChipRadioRoot'], sample), false);
    assert.equal(catalogRenders('Badge', ['Badge'], sample), false);
  });

  for (const dir of exported) {
    it(dir, () => {
      const components = exportedComponents(readFileSync(join(COMPONENTS, dir, 'index.ts'), 'utf8'));
      const missing = components.filter((name) => !catalogRenders(name, components, catalog));
      assert.deepEqual(
        missing,
        [],
        `${dir}: the state catalog does not render ${missing.join(', ')}. Add it to a section in apps/mobile/src/dev/sds-states`,
      );
    });
  }
});

/** The app's source files, the catalog aside: what counts as a production importer. */
function productionSources(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (path !== CATALOG) walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.|typetest/.test(entry.name)) {
        files.push(readFileSync(path, 'utf8'));
      }
    }
  };
  walk(join(APP, 'app'));
  walk(join(APP, 'src'));
  return files;
}

/** The names a source imports from `@skkuverse/sds`, by their exported name. */
export function sdsImports(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'@skkuverse\/sds'/g)) {
    for (const part of match[1].split(',')) {
      const name = part.replace(/\/\/.*$/gm, '').trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** The components a directory exports: the capitalised values its index names. */
export function exportedComponents(index: string): string[] {
  const names: string[] = [];
  for (const match of index.matchAll(/export\s+\{([^}]*)\}\s*from/g)) {
    for (const part of match[1].split(',')) {
      const spec = part.trim();
      if (!spec || spec.startsWith('type ')) continue;
      const name = spec.split(/\s+as\s+/).pop()!.trim();
      if (/^[A-Z][a-z]/.test(name)) names.push(name);
    }
  }
  return names;
}

describe('every exported component has an importer outside the catalogs', () => {
  const barrel = readFileSync(join(COMPONENTS, 'index.ts'), 'utf8');
  const exported = [...barrel.matchAll(/export \* from '\.\/([\w-]+)'/g)].map((match) => match[1]);
  const imported = new Set(productionSources().flatMap((source) => [...sdsImports(source)]));

  it('reads imports and exports the way the barrels write them', () => {
    assert.deepEqual(
      [...sdsImports("import {\n  Txt,\n  type ChipTone,\n  Pressable as P, // a note\n} from '@skkuverse/sds';")],
      ['Txt', 'ChipTone', 'Pressable'],
    );
    assert.deepEqual(exportedComponents("export { default as Badge, badgeVariantMap, type BadgeProps } from './Badge';"), ['Badge']);
  });

  it('finds the exported directories and the imports', () => {
    assert.ok(exported.length > 0 && imported.size > 0);
  });

  for (const dir of exported) {
    it(dir, () => {
      const components = exportedComponents(readFileSync(join(COMPONENTS, dir, 'index.ts'), 'utf8'));
      if (components.length === 0) return;
      assert.ok(
        components.some((name) => imported.has(name)),
        `${dir}: nothing in apps/mobile outside the catalogs imports ${components.join(', ')}. ` +
          'Delete the component rather than export it (sds-7 "SDS exports only components the app uses")',
      );
    });
  }
});
