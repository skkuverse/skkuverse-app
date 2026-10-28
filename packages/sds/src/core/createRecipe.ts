/** WHY: both schemes' definitions are built at module load, as `createThemedStyles` builds its sheets; a render only resolves a cached selection. */
import { SdsRadius, SdsSpacing, type ColorMode } from '@skkuverse/shared';
import { useResolvedScheme } from './ColorSchemeProvider';
import {
  compileRecipe,
  resolveRecipe,
  variantMapOf,
  type CompiledRecipe,
  type RecipeDefaults,
  type RecipeFactory,
  type RecipeSelection,
  type RecipeSlotCheck,
  type RecipeStyles,
  type RecipeTheme,
  type RecipeVariants,
  type VariantMap,
} from './recipe';
import { sdsThemes } from './theme';

const recipeThemes: Readonly<Record<ColorMode, RecipeTheme>> = {
  light: { ...sdsThemes.light, spacing: SdsSpacing, radius: SdsRadius },
  dark: { ...sdsThemes.dark, spacing: SdsSpacing, radius: SdsRadius },
};

export interface Recipe<S extends string, V extends RecipeVariants<S>> {
  (selection?: RecipeSelection<V>): RecipeStyles<S>;
  readonly variantMap: VariantMap<V>;
  readonly defaultVariants: RecipeDefaults<V>;
  resolve(scheme: ColorMode, selection?: RecipeSelection<V>): RecipeStyles<S>;
}

export function createRecipe<
  S extends string,
  V extends RecipeVariants<S> & { readonly style?: never },
  F extends RecipeFactory<S, V>,
>(recipe: F & RecipeFactory<S, V> & RecipeSlotCheck<S, F>): Recipe<S, V> {
  const factory: RecipeFactory<S, V> = recipe;
  const compiled: Readonly<Record<ColorMode, CompiledRecipe<S, V>>> = {
    light: compileRecipe(factory(recipeThemes.light)),
    dark: compileRecipe(factory(recipeThemes.dark)),
  };

  function useRecipe(selection?: RecipeSelection<V>): RecipeStyles<S> {
    return resolveRecipe(compiled[useResolvedScheme()], selection);
  }

  return Object.assign(useRecipe, {
    variantMap: variantMapOf(compiled.light.definition),
    defaultVariants: compiled.light.definition.defaultVariants,
    resolve: (scheme: ColorMode, selection?: RecipeSelection<V>) =>
      resolveRecipe(compiled[scheme], selection),
  });
}
