// The file-role vocabulary of ADR 0020 (D1, D2, D4), in one place. The `arch`
// ESLint plugin (scripts/eslint/plugin-arch.cjs) and the structure tests in
// this folder derive every role regex from these lists, so a role is added or
// renamed here and nowhere else. CommonJS, so both the plugin and the .mjs
// tests can load it.
'use strict';

/** The data roles: one server resource, one local or SDK source, client state (D1). */
const DATA_ROLES = ['client', 'repository', 'store'];
/** The domain role that combines data roles or runs ordered steps (D1). */
const SERVICE_ROLE = 'service';
/** The pure roles: no I/O, the clock passed in; they repeat by topic (D1, D2). */
const PURE_ROLES = ['schema', 'rules', 'types', 'constants'];
/** The roles that do I/O: the service and the data roles. */
const IMPURE_ROLES = [SERVICE_ROLE, ...DATA_ROLES];
/** The roles a folder holds once, so their base is the folder's name (D2, D4). */
const SINGLETON_ROLES = IMPURE_ROLES;
/** Every role below the views: what a hook or a component builds on. */
const NON_UI_ROLES = [...IMPURE_ROLES, ...PURE_ROLES];
/** The closed suffix list of a non-React `.ts` file (D4), in the order messages name it. */
const ROLES = [...NON_UI_ROLES, 'generated'];
/** The non-React roles another feature may import from a feature's root (D3). */
const DOOR_ROLES = [SERVICE_ROLE, 'constants'];
/** The pure roles a components/ folder may hold beside its components and hooks, named by topic. */
const COMPONENT_PURE_ROLES = ['rules', 'constants'];

/** A path ending in `.<role>.ts` for one of `roles`; the role is group 1. */
function roleFile(roles) {
  return new RegExp(`\\.(${roles.join('|')})\\.ts$`);
}

/** The folder names D2 bans: a folder named after a code type rather than a flow. */
const BANNED_FOLDERS = ['hooks', 'utils', 'helpers', 'store', 'stores', 'services', 'lib', 'types', 'api', 'data'];

/** A hook file's base name: `useX.ts` or `useX.tsx`. */
const HOOK_FILE = /^use[A-Z][A-Za-z0-9]*\.tsx?$/;

module.exports = {
  DATA_ROLES,
  SERVICE_ROLE,
  PURE_ROLES,
  IMPURE_ROLES,
  SINGLETON_ROLES,
  NON_UI_ROLES,
  ROLES,
  DOOR_ROLES,
  COMPONENT_PURE_ROLES,
  BANNED_FOLDERS,
  HOOK_FILE,
  roleFile,
};
