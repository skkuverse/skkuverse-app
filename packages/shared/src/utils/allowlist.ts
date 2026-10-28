/**
 * WHY: a cast such as `raw.x as 'a' | …` lets an unknown server value pass as a member and vanish
 * silently downstream; this makes the check real and leaves default-or-drop to the caller.
 */
export function asMember<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * WHY: stricter than `Number()`, which answers 0 for `null`, `''`, `[]` and `false`: a coordinate must
 * be dropped, not rendered in the Gulf of Guinea.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
