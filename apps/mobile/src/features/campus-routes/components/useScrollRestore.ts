import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import { decideScrollRestore } from '../route-view.rules';

export function useScrollRestore(initialY: number, ready: boolean, settled: boolean) {
  const scrollRef = useRef<ScrollView>(null);
  const pending = useRef(initialY);
  const sizes = useRef({ content: 0, viewport: 0 });
  const live = useRef({ ready, settled });

  const tryRestore = useCallback(() => {
    if (pending.current <= 0 || !live.current.ready) return;
    const { scrollTo, done } = decideScrollRestore({
      pending: pending.current,
      contentHeight: sizes.current.content,
      viewportHeight: sizes.current.viewport,
      settled: live.current.settled,
    });
    if (scrollTo !== null) scrollRef.current?.scrollTo({ y: scrollTo, animated: false });
    if (done) pending.current = 0;
  }, []);

  useEffect(() => {
    live.current = { ready, settled };
    tryRestore();
  }, [ready, settled, tryRestore]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      sizes.current.viewport = e.nativeEvent.layout.height;
      tryRestore();
    },
    [tryRestore],
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      sizes.current.content = height;
      tryRestore();
    },
    [tryRestore],
  );

  return { scrollRef, onLayout, onContentSizeChange };
}
