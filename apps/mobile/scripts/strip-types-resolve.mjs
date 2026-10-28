// A module resolve hook for `node --experimental-strip-types`: an extensionless relative import, as the
// app's TypeScript writes them, names the `.ts` file beside it.
const GAMES_SCHEMA = new URL('../src/features/games/games.schema.ts', import.meta.url).href;
const SHARED_SCHEMA_HELPERS = new URL('../../../packages/shared/src/schema/tolerant.ts', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  // WHY: the games schema takes only the schema helpers from the shared index, whose whole graph reaches
  // react-native's Flow source, which Node cannot parse.
  if (specifier === '@skkuverse/shared' && context.parentURL === GAMES_SCHEMA) return nextResolve(SHARED_SCHEMA_HELPERS, context);
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.{1,2}\//.test(specifier)) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}
