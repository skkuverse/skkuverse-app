// SEE: docs/explanation/miniapp-shell.md ("The iOS back swipe: the WebView's frame stays put")
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useHeaderHeight, type ParamListBase } from 'expo-router/react-navigation';
import type { WebView } from 'react-native-webview';
import { scrollToRestore, stableHeaderHeight } from './swipe-guard.rules';

// QUIRK(rnscreens): the layout comes back in a Fabric state update, so a reset can land a few
// frames after gestureCancel; the offset is read this long after it.
const RESTORE_DELAY_MS = 150;

/** SEE: docs/explanation/miniapp-shell.md ("The iOS back swipe: the WebView's frame stays put") */
export function useSwipeGuard(webRef: RefObject<WebView | null>) {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const reported = useHeaderHeight();
  const [closing, setClosing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(reported);
  // WHY: derived during render, not in an effect, so no frame paints the value it should ignore.
  const next = stableHeaderHeight(headerHeight, reported, closing);
  if (next !== headerHeight) setHeaderHeight(next);

  const scrollY = useRef(0);
  const loads = useRef(0);
  const snapshot = useRef<{ y: number; loads: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScrollY = useCallback((y: number) => {
    scrollY.current = y;
  }, []);
  const onLoadStart = useCallback(() => {
    loads.current += 1;
  }, []);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const offStart = navigation.addListener('transitionStart', (e) => {
      if (!e.data.closing) return;
      setClosing(true);
      snapshot.current = { y: scrollY.current, loads: loads.current };
    });
    const offEnd = navigation.addListener('transitionEnd', () => {
      setClosing(false);
      snapshot.current = null;
    });
    const offCancel = navigation.addListener('gestureCancel', () => {
      setClosing(false);
      const before = snapshot.current;
      snapshot.current = null;
      if (!before) return;
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        // WHY: a load in between means a different page, whose offset is its own.
        if (loads.current !== before.loads) return;
        const y = scrollToRestore(before.y, scrollY.current);
        if (y !== null) webRef.current?.injectJavaScript(`window.scrollTo(0, ${y}); true;`);
      }, RESTORE_DELAY_MS);
    });
    return () => {
      offStart();
      offEnd();
      offCancel();
      clearTimer();
    };
  }, [navigation, webRef]);

  return { headerHeight, onScrollY, onLoadStart };
}
