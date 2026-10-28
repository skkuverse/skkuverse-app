const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: watch packages/* for changes
config.watchFolders = [monorepoRoot];

// Monorepo: resolve node_modules from both app and root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// A .env file is never a module. In development Expo's virtual env module
// pulls every `.env*` file in the project root in through
// `require.context(projectRoot, false, /^\.\/\.env/)` (@expo/metro-config
// transform-worker), and only the standard names (.env, .env.local and the
// development and production variants) go through the dotenv parser that
// strips non-public keys. Any other `.env*` name would be bundled verbatim,
// secrets included. This only changes module resolution. Variables load
// as before: the CLI's @expo/env reads .env into process.env, Babel inlines
// EXPO_PUBLIC_ values in a release bundle and the dev serializer's env
// polyfill carries them in development. Only hot reload of an edited .env is
// lost. scripts/check-bundle-secrets.mjs checks it.
config.resolver.blockList = [
  ...[config.resolver.blockList ?? []].flat(),
  /[\\/]\.env(\.[^\\/]*)?$/,
];

module.exports = config;
