import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import type { MealsCode } from '../meals.types';

// WHY: a tap's own scroll is not read back for a moment, so the tab does not flick through the sections between.
const JUMP_SETTLE_MS = 600;

export function useMealSectionScroll(
  scrollRef: RefObject<ScrollView | null>,
  codes: MealsCode[],
  landingKey: string,
  landingCode: MealsCode | undefined,
) {
  const sectionY = useRef(new Map<MealsCode, number>());
  const jumpingUntil = useRef(0);
  const landing = useRef<MealsCode | null>(null);
  // WHY: keyed by landingKey, so a new cafeteria or day starts from its landing without an effect's setState.
  const [picked, setPicked] = useState<{ key: string; code: MealsCode }>();
  const active = picked?.key === landingKey ? picked.code : landingCode;

  const show = (code: MealsCode | undefined) => {
    if (code && code !== active) setPicked({ key: landingKey, code });
  };

  const scrollToSection = (code: MealsCode, animated: boolean) => {
    jumpingUntil.current = Date.now() + JUMP_SETTLE_MS;
    show(code);
    scrollRef.current?.scrollTo({ y: sectionY.current.get(code) ?? 0, animated });
  };

  useEffect(() => {
    sectionY.current.clear();
    landing.current = landingCode ?? null;
    if (!landingCode) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [landingKey]); // eslint-disable-line react-hooks/exhaustive-deps -- per cafeteria and day, never per minute tick

  return {
    activeCode: active && codes.includes(active) ? active : codes[0],
    onTabChange: (code: MealsCode) => scrollToSection(code, true),
    onSectionLayout: (code: MealsCode, e: LayoutChangeEvent) => {
      sectionY.current.set(code, e.nativeEvent.layout.y);
      if (landing.current === code) {
        landing.current = null;
        scrollToSection(code, false);
      }
    },
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Date.now() < jumpingUntil.current) return;
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 2;
      const reached = codes.filter((code) => (sectionY.current.get(code) ?? Infinity) <= contentOffset.y + 1);
      show(atEnd ? codes.at(-1) : (reached.at(-1) ?? codes[0]));
    },
    onScrollBeginDrag: () => {
      landing.current = null;
      jumpingUntil.current = 0;
    },
  };
}
