import type { AppLanguage } from '@skkuverse/shared';
import type { EntrySource } from '@/platform/analytics.rules';
import type { PromoBand, PromoCreative, PromoEntry, PromoLink, PromoParams, PromoSlot } from './promo.types';

export const PROMO_SEEN_SHARE = 0.5;

export function pickWeighted<T extends { weight: number }>(items: readonly T[], roll: number): T | null {
  const weighted = items.filter((item) => item.weight > 0);
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  const point = Math.min(Math.max(roll, 0), 1 - Number.EPSILON) * total;
  let edge = 0;
  for (const item of weighted) {
    edge += item.weight;
    if (point < edge) return item;
  }
  return weighted[weighted.length - 1] ?? null;
}

export interface DecidePromoCreativeInputs {
  openable: readonly string[];
  reviving: readonly string[];
  roll: number;
}

export function decidePromoCreative(
  creatives: readonly PromoCreative[],
  { openable, reviving, roll }: DecidePromoCreativeInputs,
): PromoCreative | null {
  const eligible = creatives.filter(({ target }) => openable.includes(target) && reviving.includes(target));
  return pickWeighted(eligible, roll);
}

/**
 * WHY: Korean only, since the copy is written for the campus audience the
 * comparison measures, and a foreign reader's taps would only add noise.
 */
export function isPromoLanguage(lang: AppLanguage): boolean {
  return lang === 'ko';
}

export function toPromoParams(slot: PromoSlot, entry: PromoEntry): PromoParams {
  return { slot, creative_id: entry.id, target: entry.target };
}

export interface DecidePromoImpressionInputs {
  visit: number;
  sentInVisit: number | undefined;
  seen: boolean;
  covered: boolean;
}

/**
 * WHY: one impression per tab visit, so a re-render, a popped sheet or a return
 * from the opened game, all in the same visit, never sends a second.
 */
export function decidePromoImpression({ visit, sentInVisit, seen, covered }: DecidePromoImpressionInputs): 'send' | 'wait' | 'done' {
  if (visit === 0 || covered) return 'wait';
  if (sentInVisit === visit) return 'done';
  return seen ? 'send' : 'wait';
}

export function toPromoEntrySource(slot: PromoSlot): EntrySource {
  return `promo:${slot}`;
}

export function toPromoLink(slot: PromoSlot, creative: PromoCreative): PromoLink {
  return { id: creative.target, via: toPromoEntrySource(slot) };
}

export function toVisibleShare(card: PromoBand, viewport: PromoBand): number {
  const height = card.bottom - card.top;
  if (height <= 0) return 0;
  const inside = Math.min(card.bottom, viewport.bottom) - Math.max(card.top, viewport.top);
  return Math.max(0, inside) / height;
}

export function isPromoSeen(card: PromoBand, viewport: PromoBand): boolean {
  return toVisibleShare(card, viewport) >= PROMO_SEEN_SHARE;
}
