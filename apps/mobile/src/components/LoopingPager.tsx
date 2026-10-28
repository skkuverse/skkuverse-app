import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  View,
  VirtualizedList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useIsFocused } from 'expo-router/react-navigation';
import { useReducedMotion } from 'react-native-reanimated';
import { SdsPalette, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { createThemedStyles, Txt } from '@skkuverse/sds';

/** WHY: about 5,000 pages of runway either way from the middle, seven hours of 5-second auto-advance. */
const LOOP_PAGES = 10_000;

interface Slide {
  index: number;
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

function middleOf(n: number, page = 0): number {
  return Math.floor(LOOP_PAGES / 2 / n) * n + page;
}

interface Props {
  pageCount: number;
  pageKey: string;
  // WHY: `estimatedWidth` sizes the slot before the first layout, so it does not grow from zero.
  height?: { forWidth(width: number): number; estimatedWidth: number };
  autoRotateMs: number;
  renderPage(page: number, current: boolean): ReactNode;
  onPageChange?(page: number): void;
  counter: 'topRight' | 'bottomRight';
  style?: StyleProp<ViewStyle>;
}

/**
 * WHY: a plain VirtualizedList over a long run of virtual pages, not a native pager module, because this
 * ships over OTA; it never rewinds across the strip or swaps clones mid-swipe.
 */
export function LoopingPager({
  pageCount,
  pageKey,
  height: sizing,
  autoRotateMs,
  renderPage,
  onPageChange,
  counter,
  style,
}: Props) {
  const styles = useStyles();
  const n = pageCount;
  const looping = n > 1;

  const listRef = useRef<VirtualizedList<Slide>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(() => (looping ? middleOf(n) : 0));
  const [dragging, setDragging] = useState(false);

  const focused = useIsFocused();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  // WHY: reset during render, not in an effect: the list is keyed on pageKey and must remount with the
  // new index as its initialScrollIndex, not the old one.
  const [seenPageKey, setSeenPageKey] = useState(pageKey);
  if (seenPageKey !== pageKey) {
    setSeenPageKey(pageKey);
    setIndex(looping ? middleOf(n) : 0);
  }

  const page = n > 0 ? index % n : 0;
  // WHY: an effect event, so a new `onPageChange` identity never reports the same page again.
  const reportPage = useEffectEvent((p: number) => onPageChange?.(p));
  useEffect(() => {
    reportPage(page);
  }, [page]);

  const canRotate = looping && autoRotateMs > 0 && width > 0 && focused && appActive && !dragging && !reducedMotion;

  // WHY: one timeout per page, not an interval: every change of `index` re-arms it, so a swipe never
  // gets cut short by a tick that was already due.
  useEffect(() => {
    if (!canRotate) return undefined;
    const timer = setTimeout(() => {
      const next = index + 1;
      if (next >= LOOP_PAGES - 1) {
        const back = middleOf(n, next % n);
        listRef.current?.scrollToOffset({ offset: back * width, animated: false });
        setIndex(back);
        return;
      }
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, autoRotateMs);
    return () => clearTimeout(timer);
  }, [canRotate, index, n, autoRotateMs, width]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.width);
      // WHY: the list is keyed on width, so it remounts at `index` for the new size.
      if (next !== width) setWidth(next);
    },
    [width],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setDragging(false);
      if (width === 0) return;
      const landed = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(Math.max(landed, 0), (looping ? LOOP_PAGES : 1) - 1));
    },
    [looping, width],
  );

  const getItem = useCallback((_: unknown, i: number): Slide => ({ index: i }), []);
  const getItemLayout = useCallback((_: unknown, i: number) => ({ length: width, offset: width * i, index: i }), [width]);

  // QUIRK(yoga): an explicit height, not `aspectRatio` on the slot, which Yoga resolves against the
  // margins and draws the card narrower than the rows around it.
  const height = sizing?.forWidth(width || sizing.estimatedWidth);

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={{ width, height }}>{renderPage(item.index % n, item.index === index)}</View>
    ),
    [height, index, n, renderPage, width],
  );

  return (
    <View style={[style, height !== undefined && { height }]} onLayout={onLayout}>
      {width > 0 && n > 0 && (
        <VirtualizedList<Slide>
          key={`${pageKey}:${width}`}
          ref={listRef}
          data={pageKey}
          getItemCount={() => (looping ? LOOP_PAGES : 1)}
          getItem={getItem}
          getItemLayout={getItemLayout}
          keyExtractor={(item) => String(item.index)}
          renderItem={renderItem}
          extraData={index}
          initialScrollIndex={index}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          horizontal
          pagingEnabled
          scrollEnabled={looping}
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setDragging(true)}
          // QUIRK(react-native): a drag that settles without momentum never fires the momentum end.
          onScrollEndDrag={() => setDragging(false)}
          onMomentumScrollEnd={onMomentumScrollEnd}
        />
      )}

      {looping && (
        <View style={[styles.counter, counter === 'topRight' ? styles.topRight : styles.bottomRight]} pointerEvents="none">
          <Txt typography="t1" fontWeight="semibold" style={styles.counterText}>
            {page + 1} / {n}
          </Txt>
        </View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  // WHY: a count, not dots: dots in one colour vanish on either a light page or a dark photo, and a
  // dark pill reads on both.
  counter: {
    position: 'absolute',
    paddingHorizontal: SdsSpacing.x2,
    paddingVertical: SdsSpacing.x0_5,
    borderRadius: SdsRadius.r2_5,
    backgroundColor: SdsPalette.static.greyOpacity500,
  },
  topRight: { right: 10, top: 10 },
  bottomRight: { right: 10, bottom: 8 },
  counterText: {
    color: SdsPalette.static.white,
    fontVariant: ['tabular-nums'],
  },
}));
