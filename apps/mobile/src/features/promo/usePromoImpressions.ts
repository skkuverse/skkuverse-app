import { useCallback, type RefObject } from 'react';
import { useWindowDimensions, type View } from 'react-native';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useLaunchStore } from '@skkuverse/shared';
import { currentTabVisit, track } from '@/platform/analytics';
import { decidePromoImpression, isPromoSeen } from './promo.rules';
import type { PromoBand, PromoParams } from './promo.types';

const CHECK_MS = 500;

// WHY: per slot and creative, the tab visit its impression was sent in. Module scope, because
// the card unmounts under a pushed sheet and mounts again, inside the same visit.
const sentInVisit = new Map<string, number>();

export interface PromoImpressionEntry {
  params: PromoParams;
  ref: RefObject<View | null>;
}

export interface PromoViewport {
  ref?: RefObject<View | null>;
  top: number;
  bottomInset: number;
}

const keyOf = ({ slot, creative_id }: PromoParams): string => `${slot}:${creative_id}`;

function measureBand(view: View): Promise<PromoBand> {
  return new Promise((resolve) => {
    view.measureInWindow((_x, top, _w, height) => resolve({ top, bottom: top + height }));
  });
}

/**
 * WHY: an entry has no scroll or detent events to listen to, so its place is
 * measured on a short interval until every entry is sent for the visit.
 */
export function usePromoImpressions(entries: readonly PromoImpressionEntry[], viewport: PromoViewport): void {
  const { height: windowHeight } = useWindowDimensions();
  const covered = useLaunchStore((s) => s.splashUp);
  const { ref: viewportRef, top, bottomInset } = viewport;

  useFocusEffect(
    useCallback(() => {
      if (entries.length === 0) return;
      let stopped = false;
      const stop = () => {
        stopped = true;
        clearInterval(timer);
      };
      const check = async () => {
        const clip = viewportRef?.current ? await measureBand(viewportRef.current) : null;
        const band = {
          top: Math.max(clip?.top ?? 0, top),
          bottom: Math.min(clip?.bottom ?? windowHeight, windowHeight - bottomInset),
        };
        let pending = 0;
        for (const { params, ref } of entries) {
          const view = ref.current;
          const seen = view ? isPromoSeen(await measureBand(view), band) : false;
          if (stopped) return;
          const visit = currentTabVisit();
          const decision = decidePromoImpression({ visit, sentInVisit: sentInVisit.get(keyOf(params)), seen, covered });
          if (decision === 'send') {
            sentInVisit.set(keyOf(params), visit);
            track('promo_impression', params);
          } else if (decision === 'wait') pending += 1;
        }
        if (pending === 0) stop();
      };
      const timer = setInterval(() => void check(), CHECK_MS);
      void check();
      return stop;
    }, [entries, viewportRef, top, bottomInset, windowHeight, covered]),
  );
}
