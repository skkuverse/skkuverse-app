// The local ESLint plugin `arch`: the import rules of the app's architecture
// (docs/decisions/0020-app-architecture.md). The root eslint.config.js
// registers it as `arch`. One rule ID per concern, so bulk suppressions
// (eslint-suppressions.json, docs/decisions/0016) keep a count per concern.
//
// Every rule reads import declarations and resolves their sources to
// repository paths: `@/x` is apps/mobile/src/x, a relative source is resolved
// from the importing file, and anything else is a package. A type-only import
// is erased at compile time and never crosses a runtime boundary, so it passes.
'use strict';

const { existsSync } = require('node:fs');
const { dirname, join, relative, resolve, sep } = require('node:path');
const {
  BANNED_FOLDERS,
  DATA_ROLES,
  DOOR_ROLES,
  HOOK_FILE,
  IMPURE_ROLES,
  NON_UI_ROLES,
  PURE_ROLES,
  roleFile,
} = require('../architecture/vocabulary.cjs');

const repoRoot = resolve(dirname(require.resolve('./plugin-arch.cjs')), '../..');
const MOBILE_SRC = 'apps/mobile/src/';
const ADR = ' See docs/decisions/0020-app-architecture.md.';

/** The repository-relative, `/`-separated form of an absolute path. */
function toRepoPath(absolute) {
  return relative(repoRoot, absolute).split(sep).join('/');
}

/**
 * The repository path an import source names, with its extension, or null for
 * a package. An unresolvable path is guessed: a PascalCase base is a `.tsx`.
 */
function resolveSource(source, filename) {
  let base;
  if (source.startsWith('@/')) base = join(repoRoot, MOBILE_SRC, source.slice(2));
  else if (source.startsWith('.')) base = resolve(dirname(filename), source);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) return toRepoPath(candidate);
  }
  const last = base.split(sep).pop();
  return toRepoPath(`${base}${/^[A-Z]/.test(last) ? '.tsx' : '.ts'}`);
}

/** Whether a declaration carries only types. */
function isTypeOnly(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') return true;
  const specifiers = node.specifiers ?? [];
  return specifiers.length > 0 && specifiers.every((s) => s.importKind === 'type' || s.exportKind === 'type');
}

/** Calls `check(node, targetPath, source)` for every runtime import with a source. */
function forEachRuntimeImport(context, check) {
  const filename = context.filename;
  const visit = (node) => {
    if (!node.source || typeof node.source.value !== 'string' || isTypeOnly(node)) return;
    check(node, resolveSource(node.source.value, filename), node.source.value);
  };
  return { ImportDeclaration: visit, ExportNamedDeclaration: visit, ExportAllDeclaration: visit };
}

const FEATURE = /^apps\/mobile\/src\/features\/([^/]+)\/(.+)$/;

/** `{ feature, pathInFeature }` for a path under features/, or null. */
function featureOf(path) {
  const match = path && FEATURE.exec(path);
  return match ? { feature: match[1], pathInFeature: match[2] } : null;
}

const DOOR_FILE = roleFile(DOOR_ROLES);

/** Whether a file name is door-shaped: a component, a `use*` hook, a `.service` or a `.constants`. */
function isDoorName(name) {
  return name.endsWith('.tsx') || HOOK_FILE.test(name) || DOOR_FILE.test(name);
}

/** Whether a path sits one level down in a folder D2 bans (`hooks/`, `utils/`, …), which is no sub-feature. */
function inBannedFolder(pathInFeature) {
  const parts = pathInFeature.split('/');
  return parts.length === 2 && BANNED_FOLDERS.includes(parts[0]);
}

/**
 * Whether another feature, or a route, may import this file of a feature (D3):
 * a door-shaped file at the feature's root or at a sub-feature's root one level
 * down. `components/` is private at any depth, and a banned folder is no sub-feature.
 */
function isFeatureDoor(pathInFeature) {
  const parts = pathInFeature.split('/');
  if (parts.length > 2 || parts.includes('components') || inBannedFolder(pathInFeature)) return false;
  return isDoorName(parts[parts.length - 1]);
}

/** A door-shaped file in a banned folder: `arch/banned-folder-door` reports it, so the other door rules skip it. */
function isBannedFolderDoor(pathInFeature) {
  return inBannedFolder(pathInFeature) && isDoorName(pathInFeature.split('/')[1]);
}

const featureDoor = {
  meta: {
    type: 'problem',
    docs: { description: "A feature, or a shared component, imports a feature only through its root or a sub-feature's root: a component, a use* hook, its .service or its .constants (ADR 0020 D3)." },
    schema: [],
    messages: {
      private:
        "'{{source}}' is private to the {{target}} feature. Import a component, use* hook, .service or .constants at its root or a sub-feature's root, or import type." +
        ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    const self = featureOf(path);
    // WHY: bootstrap/, components/, dev/ and platform/ stay (D2), so every app file is checked.
    if (!path.startsWith(MOBILE_SRC)) return {};
    return forEachRuntimeImport(context, (node, target, source) => {
      const other = featureOf(target);
      if (!other || other.feature === self?.feature) return;
      if (isFeatureDoor(other.pathInFeature) || isBannedFolderDoor(other.pathInFeature)) return;
      context.report({ node, messageId: 'private', data: { source, target: other.feature } });
    });
  },
};

/**
 * The first-level sub-feature a path sits in, or null at the feature's root
 * (D2). `components/` is the feature's own private folder, and a banned or
 * underscore folder (`hooks/`, `__fixtures__/`) is no sub-feature.
 */
function subFeatureOf(pathInFeature) {
  const parts = pathInFeature.split('/');
  if (parts.length < 2) return null;
  const folder = parts[0];
  if (folder === 'components' || BANNED_FOLDERS.includes(folder) || folder.startsWith('__')) return null;
  return folder;
}

const siblingImport = {
  meta: {
    type: 'problem',
    docs: { description: "Sub-features of one feature never import each other; what two of them need lives at the parent's root or its components/ (ADR 0020 D2)." },
    schema: [],
    messages: {
      sibling:
        "'{{source}}' belongs to the sibling sub-feature {{target}}/. Siblings never import each other: move what both need to the parent's root or its components/, or import type." +
        ADR,
    },
  },
  create(context) {
    const self = featureOf(toRepoPath(context.filename));
    const selfSub = self ? subFeatureOf(self.pathInFeature) : null;
    if (!selfSub) return {};
    return forEachRuntimeImport(context, (node, target, source) => {
      const other = featureOf(target);
      if (!other || other.feature !== self.feature) return;
      const otherSub = subFeatureOf(other.pathInFeature);
      if (otherSub && otherSub !== selfSub) {
        context.report({ node, messageId: 'sibling', data: { source, target: otherSub } });
      }
    });
  },
};

const bannedFolderDoor = {
  meta: {
    type: 'problem',
    docs: { description: "A folder named after a code type is no sub-feature, so another feature, a shared component or a route never imports a file in it (ADR 0020 D2, D3)." },
    schema: [],
    messages: {
      bannedFolder:
        "'{{source}}' sits in {{folder}}/, a code-type folder rather than a sub-feature, so it is private to the {{target}} feature. Move it to the feature's root or a sub-feature's root, or import type." +
        ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    const self = featureOf(path);
    if (!path.startsWith(MOBILE_SRC) && !path.startsWith('apps/mobile/app/')) return {};
    return forEachRuntimeImport(context, (node, target, source) => {
      const other = featureOf(target);
      if (!other || other.feature === self?.feature || !isBannedFolderDoor(other.pathInFeature)) return;
      const folder = other.pathInFeature.split('/')[0];
      context.report({ node, messageId: 'bannedFolder', data: { source, folder, target: other.feature } });
    });
  },
};

const DATA_FILE = roleFile(DATA_ROLES);
const DATA_PACKAGE = /^(@react-native-firebase\/(firestore|functions)|react-native-mmkv|axios)(\/|$)/;
const NON_UI_FILE = roleFile(NON_UI_ROLES);

/** `route`, `view` (a .tsx under features/ or components/), `nonUi` (a service, data or pure role file), or null. */
function layerOf(path) {
  if (path.startsWith('apps/mobile/app/')) return 'route';
  if (/^apps\/mobile\/src\/(features|components)\/.+\.tsx$/.test(path)) return 'view';
  if (path.startsWith(MOBILE_SRC) && NON_UI_FILE.test(path)) return 'nonUi';
  return null;
}

const layerImports = {
  meta: {
    type: 'problem',
    docs: { description: 'Layers depend downward only: views never reach data access, data or pure files never import UI, and a .types.ts never names a .tsx type (ADR 0020 D1, D4).' },
    schema: [],
    messages: {
      data:
        "A {{layer}} reaches data access through '{{source}}'. Go through the feature's use* ViewModel hook instead." + ADR,
      private:
        "'{{source}}' is private to the {{target}} feature. A route renders a screen at a feature's root or a sub-feature's root." + ADR,
      ui: "A data or pure file imports UI code ('{{source}}'). Return data, and let a hook or component render it." + ADR,
      typesUi:
        "A .types.ts names a type from UI code ('{{source}}'). Declare the data's own type here, and let the view adapt to it." + ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    const layer = layerOf(path);
    if (!layer) return {};
    const runtime = forEachRuntimeImport(context, (node, target, source) => {
      if (layer === 'nonUi') {
        if (target && target.endsWith('.tsx')) context.report({ node, messageId: 'ui', data: { source } });
        return;
      }
      if ((target && DATA_FILE.test(target)) || (!target && DATA_PACKAGE.test(source))) {
        context.report({ node, messageId: 'data', data: { source, layer: layer === 'route' ? 'route' : 'screen or component' } });
        return;
      }
      const other = featureOf(target);
      if (layer === 'route' && other && !isFeatureDoor(other.pathInFeature) && !isBannedFolderDoor(other.pathInFeature)) {
        context.report({ node, messageId: 'private', data: { source, target: other.feature } });
      }
    });
    if (!path.endsWith('.types.ts')) return runtime;
    // WHY: a runtime import of a .tsx is the `ui` report above; this adds the type-only ones (D4).
    const typeOnly = (node) => {
      if (!node.source || typeof node.source.value !== 'string' || !isTypeOnly(node)) return;
      const target = resolveSource(node.source.value, context.filename);
      if (target && target.endsWith('.tsx')) context.report({ node, messageId: 'typesUi', data: { source: node.source.value } });
    };
    return Object.fromEntries(
      Object.entries(runtime).map(([selector, visit]) => [
        selector,
        (node) => {
          visit(node);
          typeOnly(node);
        },
      ]),
    );
  },
};

/**
 * The rank of each non-UI role in D1's order: a file imports only a rank
 * below its own, or its own rank's same role.
 */
const DATA_RANK = { store: 1, client: 2, repository: 2, service: 3 };
const RANKED_FILE = roleFile(NON_UI_ROLES);

/** The non-UI role a path's suffix names, or null. */
function roleOf(path) {
  return (path && RANKED_FILE.exec(path)?.[1]) ?? null;
}

const dataDirection = {
  meta: {
    type: 'problem',
    docs: { description: 'Data roles import downward only: service > client, repository > store > pure. A client and a repository never import each other (ADR 0020 D1).' },
    schema: [],
    messages: {
      store:
        "A store imports a {{target}} ('{{source}}'). A store holds client state only: let the feature's .service or ViewModel call the {{target}} and write the store." +
        ADR,
      sibling:
        "A {{importer}} imports a {{target}} ('{{source}}'). A client and a repository never import each other; combine them in the feature's .service." +
        ADR,
      service:
        "A {{importer}} imports a service ('{{source}}'). Dependencies point down: the service calls the {{importer}}, never the reverse." +
        ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    const importer = path.startsWith(MOBILE_SRC) ? roleOf(path) : null;
    // WHY: a pure file reaching up is arch/pure-files' `io` report already.
    if (!importer || !Object.hasOwn(DATA_RANK, importer)) return {};
    return forEachRuntimeImport(context, (node, target, source) => {
      const role = roleOf(target);
      if (!role || !Object.hasOwn(DATA_RANK, role)) return;
      const data = { importer, target: role, source };
      if (importer === 'store' && role !== 'store') context.report({ node, messageId: 'store', data });
      else if (role === 'service' && importer !== 'service') context.report({ node, messageId: 'service', data });
      else if (DATA_RANK[importer] === 2 && DATA_RANK[role] === 2 && importer !== role) {
        context.report({ node, messageId: 'sibling', data });
      }
    });
  },
};

const STORE_HOOK = /^use[A-Z][A-Za-z0-9]*Store$/;

const storeAccess = {
  meta: {
    type: 'problem',
    docs: { description: 'Only ViewModels and services read stores: a route, screen or component never imports a shared use*Store hook (ADR 0020 D12).' },
    schema: [],
    messages: {
      store: "A {{layer}} reads '{{name}}'. Read it in the feature's use* ViewModel and pass the value down." + ADR,
    },
  },
  create(context) {
    const layer = layerOf(toRepoPath(context.filename));
    if (layer !== 'route' && layer !== 'view') return {};
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (isTypeOnly(node) || !isSharedPackage(source)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier' || specifier.importKind === 'type') continue;
          const name = importedName(specifier);
          if (!STORE_HOOK.test(name)) continue;
          context.report({ node: specifier, messageId: 'store', data: { name, layer: layer === 'route' ? 'route' : 'screen or component' } });
        }
      },
    };
  },
};

/** Whether an import source is the shared package or one of its files. */
function isSharedPackage(source) {
  return source === '@skkuverse/shared' || source.startsWith('@skkuverse/shared/');
}

/** The exported name a named import specifier reads. */
function importedName(specifier) {
  return specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;
}

// The shared package's exports that do I/O: the request wrappers, the axios
// client and the MMKV cache (packages/shared/src/index.ts).
const SHARED_IO = /^(safe[A-Z][A-Za-z0-9]*|firePost|(get|create|reset)ApiClient|(read|write|clear)Cache)$/;
const STORE_OBJECT = /^(?!use[A-Z])[a-z][A-Za-z0-9]*Store$/;

const sharedIo = {
  meta: {
    type: 'problem',
    docs: { description: "Views and pure files never import the shared package's I/O: request wrappers, the API client, the cache or a store object (ADR 0020 D1, D12)." },
    schema: [],
    messages: {
      viewIo:
        "A {{layer}} imports '{{name}}', which does I/O. Call it in the feature's .client, .repository or .service, and read the result through its use* ViewModel." +
        ADR,
      viewStore: "A {{layer}} imports the store '{{name}}'. Read it in the feature's use* ViewModel and pass the value down." + ADR,
      pureIo: "A pure file imports '{{name}}', which does I/O. Take the value as an argument; a .client, .repository or .service calls it." + ADR,
      pureStore: "A pure file reads the store '{{name}}'. Take the state as an argument; a ViewModel or .service reads the store." + ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    const layer = layerOf(path);
    const pure = path.startsWith(MOBILE_SRC) && PURE_FILE.test(path);
    if (layer !== 'route' && layer !== 'view' && !pure) return {};
    return {
      ImportDeclaration(node) {
        if (isTypeOnly(node) || !isSharedPackage(String(node.source.value))) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier' || specifier.importKind === 'type') continue;
          const name = importedName(specifier);
          // WHY: a view's use*Store is arch/store-access' report already.
          const store = STORE_OBJECT.test(name) || (pure && STORE_HOOK.test(name));
          if (!store && !SHARED_IO.test(name)) continue;
          const messageId = `${pure ? 'pure' : 'view'}${store ? 'Store' : 'Io'}`;
          context.report({ node: specifier, messageId, data: { name, layer: layer === 'route' ? 'route' : 'screen or component' } });
        }
      },
    };
  },
};

const REACT_QUERY = /^@tanstack\/react-query(\/|$)/;

const viewData = {
  meta: {
    type: 'problem',
    docs: { description: 'A route, screen or component never imports React Query at runtime: server state reaches it through a use* ViewModel (ADR 0020 D1, D11).' },
    schema: [],
    messages: {
      query:
        "A {{layer}} imports '{{name}}' from React Query. Query in the feature's use* ViewModel, with the queryOptions from its .client, .repository or .service, and pass the result down." +
        ADR,
    },
  },
  create(context) {
    const layer = layerOf(toRepoPath(context.filename));
    if (layer !== 'route' && layer !== 'view') return {};
    return {
      ImportDeclaration(node) {
        if (isTypeOnly(node) || !REACT_QUERY.test(String(node.source.value))) return;
        for (const specifier of node.specifiers) {
          if (specifier.importKind === 'type') continue;
          const name = specifier.type === 'ImportSpecifier' ? importedName(specifier) : specifier.local.name;
          context.report({ node: specifier, messageId: 'query', data: { name, layer: layer === 'route' ? 'route' : 'screen or component' } });
        }
      },
    };
  },
};

const PURE_FILE = roleFile(PURE_ROLES);
const IMPURE_PACKAGE = /^(react|react-native|axios|react-native-mmkv|@react-native-firebase\/.*|expo(-[^/]*)?)(\/|$)/;
const IMPURE_ROLE_FILE = roleFile(IMPURE_ROLES);

/** Whether a repository path does I/O or renders: a service, data or `.tsx` file. */
function isImpureFile(path) {
  return IMPURE_ROLE_FILE.test(path) || path.endsWith('.tsx');
}

const pureFiles = {
  meta: {
    type: 'problem',
    docs: { description: 'A pure file (schema, rules, types, constants) does no I/O and takes the time as an argument (ADR 0020 D1).' },
    schema: [],
    messages: {
      io: "A pure file imports '{{source}}', which does I/O or renders. Take the value as an argument instead." + ADR,
      clock: 'A pure file reads the clock. Take `now` as an argument so the decision can be tested at any instant.' + ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    if (!PURE_FILE.test(path)) return {};
    const imports = forEachRuntimeImport(context, (node, target, source) => {
      // WHY: a platform wrapper does I/O, but its pure companion (`analytics.rules.ts`) is held to this rule itself.
      const platformWrapper = target?.startsWith(`${MOBILE_SRC}platform/`) && !PURE_FILE.test(target);
      const io = target ? isImpureFile(target) || platformWrapper : IMPURE_PACKAGE.test(source);
      if (io) context.report({ node, messageId: 'io', data: { source } });
    });
    return {
      ...imports,
      "CallExpression[callee.object.name='Date'][callee.property.name='now']"(node) {
        context.report({ node, messageId: 'clock' });
      },
      "NewExpression[callee.name='Date'][arguments.length=0]"(node) {
        context.report({ node, messageId: 'clock' });
      },
    };
  },
};

/** Each cross-cutting SDK, and the one platform wrapper that may import it at runtime. */
const PLATFORM_SDKS = {
  '@react-native-firebase/analytics': 'platform/analytics.ts',
  '@react-native-firebase/crashlytics': 'platform/crashlytics.ts',
  '@react-native-firebase/app-check': 'platform/app-check.ts',
  '@hot-updater/react-native': 'platform/ota.ts',
  'expo-haptics': 'platform/haptics.ts',
  'expo-store-review': 'platform/store-review.ts',
  'expo-location': 'platform/location.ts',
  '@react-native-firebase/messaging': 'platform/messaging.ts',
  'expo-notifications': 'platform/notifications.ts',
};

const platformSdk = {
  meta: {
    type: 'problem',
    docs: { description: 'A cross-cutting native SDK is imported only by its platform wrapper (ADR 0020 D1, D2).' },
    schema: [],
    messages: {
      sdk: "'{{source}}' is reached through {{wrapper}}, the one file that imports it. Call the wrapper, or add what you need to it." + ADR,
    },
  },
  create(context) {
    if (toRepoPath(context.filename).startsWith(`${MOBILE_SRC}platform/`)) return {};
    return forEachRuntimeImport(context, (node, target, source) => {
      const wrapper = target ? undefined : PLATFORM_SDKS[source];
      if (wrapper) context.report({ node, messageId: 'sdk', data: { source, wrapper } });
    });
  },
};

const ZOD_BANNED = {
  strictObject: 'strict',
  coerce: 'coerce',
  discriminatedUnion: 'union',
};

const zodUsage = {
  meta: {
    type: 'problem',
    docs: { description: 'Server responses parse tolerantly: no strict objects, no coercion, no closed discriminated unions (ADR 0020 D6).' },
    schema: [],
    messages: {
      strict: 'A strict object fails the day the server adds a field, on every installed build. Use z.object, which ignores unknown keys.' + ADR,
      coerce: 'z.coerce reads null, "" and false as 0. Use finiteNumber from @skkuverse/shared.' + ADR,
      union: 'A discriminated union fails on a kind this build does not know. Use openUnionArray from @skkuverse/shared.' + ADR,
    },
  },
  create(context) {
    const zodNames = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'zod' && !String(node.source.value).startsWith('zod/')) return;
        for (const specifier of node.specifiers) zodNames.add(specifier.local.name);
      },
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !zodNames.has(node.object.name)) return;
        const name = node.property.type === 'Identifier' ? node.property.name : null;
        if (name && Object.hasOwn(ZOD_BANNED, name)) context.report({ node, messageId: ZOD_BANNED[name] });
      },
      "CallExpression[arguments.length=0] > MemberExpression.callee[property.name='strict']"(node) {
        if (zodNames.size > 0) context.report({ node, messageId: 'strict' });
      },
    };
  },
};

/** The identifier a member or call chain starts from (`z` in `z.string().array()`), or null. */
function chainRoot(node) {
  let current = node;
  while (current.type === 'MemberExpression' || current.type === 'CallExpression') {
    current = current.type === 'MemberExpression' ? current.object : current.callee;
  }
  return current.type === 'Identifier' ? current.name : null;
}

const SCHEMA_FILE = /^(apps\/mobile\/src|packages\/shared\/src)\/.+\.schema\.ts$/;
// WHY: the helpers parse the raw list as z.array(z.unknown()) and filter it themselves.
const TOLERANT_HELPERS = 'packages/shared/src/schema/tolerant.ts';
const CLOSED_ENUM = new Set(['enum', 'nativeEnum']);

const tolerantSchema = {
  meta: {
    type: 'problem',
    docs: { description: 'A .schema.ts reads lists and enums tolerantly: no bare z.array or .array(), no closed z.enum (ADR 0020 D6).' },
    schema: [],
    messages: {
      array:
        'A bare zod array fails the whole response on one malformed item. Use tolerantArray(item, where) from @skkuverse/shared, which drops and logs that item alone.' +
        ADR,
      enum: 'A closed zod enum fails on a value this build does not know. Use openEnum(values, fallback) from @skkuverse/shared.' + ADR,
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    if (!SCHEMA_FILE.test(path) || path === TOLERANT_HELPERS) return {};
    const zodNames = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'zod' && !String(node.source.value).startsWith('zod/')) return;
        for (const specifier of node.specifiers) zodNames.add(specifier.local.name);
      },
      'CallExpression > MemberExpression.callee'(node) {
        const name = node.property.type === 'Identifier' ? node.property.name : null;
        if (!name || !zodNames.has(chainRoot(node))) return;
        const direct = node.object.type === 'Identifier';
        if (name === 'array') context.report({ node, messageId: 'array' });
        else if (direct && CLOSED_ENUM.has(name)) context.report({ node, messageId: 'enum' });
      },
    };
  },
};

/** Whether a cast names `const`: `as const` freezes a literal, it asserts nothing about input. */
function isConstCast(node) {
  const type = node.typeAnnotation;
  return type.type === 'TSTypeReference' && type.typeName.type === 'Identifier' && type.typeName.name === 'const';
}

const CAST = new Set(['TSAsExpression', 'TSTypeAssertion']);

const schemaCast = {
  meta: {
    type: 'problem',
    docs: { description: 'A .schema.ts checks what the server sent and never asserts it with a cast, a non-null assertion or `any` (ADR 0020 D6).' },
    schema: [],
    messages: {
      cast:
        'A cast in a schema asserts what the server sent instead of checking it, so a wrong value passes as typed. Read the field through zod: text, optionalText, finiteNumber, openEnum, tolerantArray from @skkuverse/shared, or z.object for a nested object.' +
        ADR,
      nonNull:
        'A non-null assertion in a schema asserts the server sent a value instead of checking it. Read the field through zod, where a missing value fails the field or takes its fallback.' +
        ADR,
      any: '`any` in a schema turns the check off for everything it touches. Take `unknown` and read it through zod.' + ADR,
    },
  },
  create(context) {
    if (!SCHEMA_FILE.test(toRepoPath(context.filename))) return {};
    const reportCast = (node) => {
      // WHY: `<T>(x as unknown)` and `x as unknown as T` are one cast, reported once, at the outer one.
      if (CAST.has(node.parent.type)) return;
      context.report({ node, messageId: 'cast' });
    };
    return {
      TSAsExpression(node) {
        if (!isConstCast(node)) reportCast(node);
      },
      TSTypeAssertion: reportCast,
      TSNonNullExpression(node) {
        context.report({ node, messageId: 'nonNull' });
      },
      TSAnyKeyword(node) {
        context.report({ node, messageId: 'any' });
      },
    };
  },
};

// WHY: the structure rules check a file's shape and name, never its size, and useMapHost grew
// to 842 code lines unnoticed. A ratchet on size: over-limit files are recorded per step and
// may only shrink, and a new file starts within its budget.
// SEE: docs/decisions/0025-ratchet-file-size.md
const SIZE_LIMITS = { hook: 250, file: 400 };
const SIZE_STEP = 50;

// WHY: comment lines count, as the server's max-lines counts them, so a comment costs budget like the code it explains.
/** The line numbers that hold code or a comment, in order. Blank lines are left out. */
function nonBlankLineNumbers(sourceCode) {
  const lines = new Set();
  for (const token of [...sourceCode.ast.tokens, ...sourceCode.getAllComments()]) {
    for (let line = token.loc.start.line; line <= token.loc.end.line; line++) lines.add(line);
  }
  return [...lines].sort((a, b) => a - b);
}

const HOOK_NAME = /^use[A-Z]/;

/** The names of the functions a program exports, and of its default export when it is a named function. */
function exportedFunctions(program) {
  const names = [];
  let byDefault = null;
  for (const statement of program.body) {
    const declaration = statement.declaration;
    if (!declaration) continue;
    if (declaration.type === 'FunctionDeclaration' && declaration.id) {
      names.push(declaration.id.name);
      if (statement.type === 'ExportDefaultDeclaration') byDefault = declaration.id.name;
    } else if (declaration.type === 'VariableDeclaration') {
      for (const d of declaration.declarations) {
        const fn = d.init && (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression');
        if (fn && d.id.type === 'Identifier') names.push(d.id.name);
      }
    }
  }
  return { names, byDefault };
}

/** Whether a file is a hook: named `use*`, default-exporting a `use*` function, or exporting only `use*` functions. */
function isHookFile(path, program) {
  if (HOOK_FILE.test(path.split('/').pop())) return true;
  const { names, byDefault } = exportedFunctions(program);
  if (byDefault) return HOOK_NAME.test(byDefault);
  return names.length > 0 && names.every((name) => HOOK_NAME.test(name));
}

const fileSize = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'A use* hook holds at most 250 non-blank lines, comments included, and a view, route, service, data or platform file at most 400; one report per 50 lines past it (ADR 0025).',
    },
    schema: [],
    messages: {
      size:
        'This {{kind}} passes {{at}} non-blank lines (limit {{limit}}, now {{count}}). {{advice}} Each {{step}} lines past the limit is one report, recorded until the file shrinks.' +
        ' See docs/decisions/0025-ratchet-file-size.md.',
    },
  },
  create(context) {
    const path = toRepoPath(context.filename);
    if (!path.startsWith(MOBILE_SRC) && !path.startsWith('apps/mobile/app/')) return {};
    // WHY: a pure file is split by subject, not by size (ADR 0020 D2), and a generated one is not edited.
    if (PURE_FILE.test(path) || path.endsWith('.generated.ts')) return {};
    const hook = isHookFile(path, context.sourceCode.ast);
    const limit = hook ? SIZE_LIMITS.hook : SIZE_LIMITS.file;
    const data = hook
      ? { kind: 'use* hook', advice: 'Move a concern into its own private hook in components/, and a decision into a .rules file.' }
      : { kind: 'file', advice: 'Move a section into its own component or hook, a decision into a .rules file, or a flow into its own sub-feature.' };
    return {
      'Program:exit'() {
        const lines = nonBlankLineNumbers(context.sourceCode);
        for (let passed = limit; passed < lines.length; passed += SIZE_STEP) {
          // WHY line 1: the Nth code line moves with every edit above it, so a disable there would go stale.
          context.report({
            loc: { line: 1, column: 0 },
            messageId: 'size',
            data: { ...data, at: String(passed), limit: String(limit), count: String(lines.length), step: String(SIZE_STEP) },
          });
        }
      },
    };
  },
};

module.exports = {
  meta: { name: 'arch' },
  rules: {
    'data-direction': dataDirection,
    'banned-folder-door': bannedFolderDoor,
    'feature-door': featureDoor,
    'file-size': fileSize,
    'layer-imports': layerImports,
    'platform-sdk': platformSdk,
    'schema-cast': schemaCast,
    'pure-files': pureFiles,
    'shared-io': sharedIo,
    'sibling-import': siblingImport,
    'store-access': storeAccess,
    'tolerant-schema': tolerantSchema,
    'view-data': viewData,
    'zod-usage': zodUsage,
  },
  // For the rule tests.
  _internal: { SIZE_LIMITS, SIZE_STEP, resolveSource, featureOf, isFeatureDoor, isBannedFolderDoor, toRepoPath, repoRoot },
};
