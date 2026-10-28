/** WHY: recipe.test.mts loads this file under plain Node, so it imports types only. */
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { ColorMode, SdsRadius, SdsSpacing, SemanticColors } from '@skkuverse/shared';

export type RecipeStyle = ViewStyle & TextStyle & ImageStyle;

/** WHY: every token arrives here rather than through an import, so a definition loads under `node --test` with stand-in values. */
export interface RecipeTheme {
  readonly scheme: ColorMode;
  readonly color: SemanticColors;
  readonly spacing: typeof SdsSpacing;
  readonly radius: typeof SdsRadius;
}

type SlotStyles<S extends string> = { readonly [K in S]?: RecipeStyle };

export type RecipeVariants<S extends string> = {
  readonly [variant: string]: { readonly [value: string]: SlotStyles<S> };
};

export type VariantValue<K> = K extends 'true' | 'false' ? boolean : K;

export type VariantValues<V, K extends keyof V> = VariantValue<keyof V[K] & string>;

export type RecipeSelection<V> = {
  readonly [K in keyof V]?: VariantValues<V, K> | undefined;
};

export type RecipeDefaults<V> = { readonly [K in keyof V]: VariantValues<V, K> };

export type RecipeCompound<S extends string, V> = {
  readonly [K in keyof V]?: VariantValues<V, K> | readonly VariantValues<V, K>[];
} & { readonly style: SlotStyles<S> };

export interface RecipeDefinition<S extends string, V extends RecipeVariants<S>> {
  readonly base: { readonly [K in S]: RecipeStyle };
  readonly variants: V;
  readonly compoundVariants?: readonly RecipeCompound<NoInfer<S>, NoInfer<V>>[];
  readonly defaultVariants: RecipeDefaults<NoInfer<V>>;
}

export type RecipeFactory<S extends string, V extends RecipeVariants<S>> = (
  theme: RecipeTheme,
) => RecipeDefinition<S, V>;

type VariantSlots<V> = {
  [K in keyof V]: { [Val in keyof V[K]]: keyof V[K][Val] }[keyof V[K]];
}[keyof V];
type CompoundSlots<D> = D extends { readonly compoundVariants?: readonly (infer C)[] }
  ? C extends { readonly style: infer St }
    ? keyof St
    : never
  : never;

/** QUIRK(typescript): a definition in its own module is no object literal at the call, so the excess-property check never sees a misspelt slot; this fails it. */
export type RecipeSlotCheck<S extends string, F> = F extends (theme: RecipeTheme) => infer D
  ? D extends { readonly variants: infer V }
    ? [Exclude<VariantSlots<V> | CompoundSlots<D>, S>] extends [never]
      ? unknown
      : { readonly unknownSlots: Exclude<VariantSlots<V> | CompoundSlots<D>, S> }
    : unknown
  : unknown;

export type RecipeStyles<S extends string> = { readonly [K in S]: RecipeStyle };

export type VariantMap<V> = { readonly [K in keyof V]: readonly VariantValues<V, K>[] };

export interface CompiledRecipe<S extends string, V extends RecipeVariants<S>> {
  readonly definition: RecipeDefinition<S, V>;
  readonly slots: readonly S[];
  readonly variantNames: readonly (keyof V & string)[];
  readonly cache: Map<string, RecipeStyles<S>>;
}

export function compileRecipe<S extends string, V extends RecipeVariants<S>>(
  definition: RecipeDefinition<S, V>,
): CompiledRecipe<S, V> {
  return {
    definition,
    slots: Object.keys(definition.base) as S[],
    variantNames: Object.keys(definition.variants) as (keyof V & string)[],
    cache: new Map(),
  };
}

function toKey(value: unknown): string {
  return String(value);
}

function fromKey(key: string): string | boolean {
  return key === 'true' ? true : key === 'false' ? false : key;
}

function matches(
  compound: Readonly<Record<string, unknown>>,
  selected: Readonly<Record<string, string>>,
): boolean {
  for (const [name, want] of Object.entries(compound)) {
    if (name === 'style' || want === undefined) continue;
    const values = Array.isArray(want) ? want : [want];
    if (!values.some((value) => toKey(value) === selected[name])) return false;
  }
  return true;
}

export function resolveRecipe<S extends string, V extends RecipeVariants<S>>(
  compiled: CompiledRecipe<S, V>,
  selection: RecipeSelection<V> = {},
): RecipeStyles<S> {
  const { definition, slots, variantNames, cache } = compiled;
  const picks = selection as Readonly<Record<string, unknown>>;
  const defaults = definition.defaultVariants as Readonly<Record<string, unknown>>;

  const selected: Record<string, string> = {};
  for (const name of variantNames) {
    selected[name] = toKey(picks[name] ?? defaults[name]);
  }
  const key = variantNames.map((name) => `${name}=${selected[name]}`).join('|');

  const hit = cache.get(key);
  if (hit) return hit;

  const layers: SlotStyles<S>[] = [definition.base];
  for (const name of variantNames) {
    const layer = definition.variants[name][selected[name]];
    if (layer) layers.push(layer);
  }
  for (const compound of definition.compoundVariants ?? []) {
    if (matches(compound as Readonly<Record<string, unknown>>, selected)) layers.push(compound.style);
  }

  const resolved = {} as Record<S, RecipeStyle>;
  for (const slot of slots) {
    resolved[slot] = Object.assign({}, ...layers.map((layer) => layer[slot]));
  }
  cache.set(key, resolved);
  return resolved;
}

export function variantMapOf<S extends string, V extends RecipeVariants<S>>(
  definition: RecipeDefinition<S, V>,
): VariantMap<V> {
  const map: Record<string, (string | boolean)[]> = {};
  for (const [name, values] of Object.entries(definition.variants)) {
    map[name] = Object.keys(values).map(fromKey);
  }
  return map as unknown as VariantMap<V>;
}
