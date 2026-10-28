/**
 * SEE: docs/explanation/bottom-sheet-system.md ("The rule that decides the surface"): a card is glass while it floats
 * and opaque once it attaches, and `large` is the detent that attaches.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackHandler, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetSectionList,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import { createThemedStyles } from '../../core/theme';
import { SurfaceContext } from '../../core/SurfaceContext';
import { GLASS_AVAILABLE } from '../glass';
import {
  endsInPage,
  largeHeightOf,
  pageSpacerHeight,
  resolveSheetPosition,
  steppedDetentIndex,
  type SheetDetent,
  type SheetPosition,
} from './detents';
import { sheetChromeAt, sheetPageRamp, SHEET_FLOAT_INSET, type SheetCardKind } from './chrome';
import { AttachedSheetBackground } from './AttachedSheetBackground';
import { SheetCardClip } from './SheetCardClip';
import { StuckSheetBackground } from './StuckSheetBackground';
import { ExpandableSheetBackground } from './ExpandableSheetBackground';
import { SHEET_HANDLE_HEIGHT, SheetHandle, type SheetHandleA11y } from './SheetHandle';
import { SheetCloseButton } from './SheetCloseButton';
import { SheetHeader } from './SheetHeader';
import { SheetScrollView } from './SheetScrollView';

export type SheetAnimationConfig = WithSpringConfig | WithTimingConfig;

export interface SheetRef {
  snapToIndex: (index: number, animationConfigs?: SheetAnimationConfig) => void;
  /** QUIRK(gorhom-bottom-sheet): the sheet reports index -1 while it rests off the detents, and a later `snapToIndex` starts from that height. */
  snapToPosition: (position: number | string, animationConfigs?: SheetAnimationConfig) => void;
  expand: () => void;
  collapse: () => void;
  close: (animationConfigs?: SheetAnimationConfig) => void;
  forceClose: () => void;
  /** WHY: modal sheets only, and optional rather than asserted, so a call on an inline sheet is a type error at the call site instead of a crash. */
  present?: () => void;
  dismiss?: () => void;
}

export interface SheetProps {
  /**
   * QUIRK(gorhom-bottom-sheet): a modal is portalled to a host mounted after the provider's children, the
   * navigator among them, so it paints over a screen pushed under it; a modal that navigates dismisses first.
   */
  presentation?: 'modal' | 'inline';
  position: SheetPosition;
  surface?: 'solid' | 'glass';
  dismissible?: boolean;
  /** WHY: a glass card gets a much lighter scrim, because glass samples what is behind it and a full scrim turns it into a flat grey panel. */
  backdrop?: boolean;
  /** WHY: percentage detents resolve against an inline sheet's container, the host screen's own box, which only the host can measure. */
  containerHeight?: number;
  /**
   * SEE: docs/explanation/bottom-sheet-system.md ("The bottom gap is not the side gap"): a modal lining up with an inline card restates
   * that card's bottom edge here. It moves the card, so it cannot clear a tab bar floating over the content.
   */
  bottomGap?: number;
  footer?: ReactNode;
  androidKeyboardInputMode?: 'adjustPan' | 'adjustResize';
  /** WHY: gorhom's default, restated: `switch` minimises the sheet underneath and resurfaces it on close, wrong for a sheet that replaces what it opened over. */
  stackBehavior?: 'push' | 'replace' | 'switch';
  /** WHY: drive a sheet from `open` or from the ref, never both: two sources of truth disagree the first time the user swipes it away. */
  open?: boolean;
  /** WHY: a copy that can trail the body by a frame, so use it only outside the sheet; inside, use `useSheetMotion`. */
  animatedIndex?: SharedValue<number>;
  /** WHY: as `animatedIndex`, a trailing copy for outside the sheet only. */
  animatedPosition?: SharedValue<number>;
  onChange?: (index: number) => void;
  onClose?: () => void;
  onDismiss?: () => void;
  /** QUIRK(gorhom-bottom-sheet): `present()` takes no animation override, so a modal that must arrive fast says so here. */
  animationConfigs?: SheetAnimationConfig;
  style?: StyleProp<ViewStyle>;
  /**
   * QUIRK(gorhom-bottom-sheet): the body is otherwise one accessibility element, which hides every control in it from VoiceOver;
   * named, the handle becomes the sheet's adjustable control.
   */
  accessibility?: { label: string; detentLabels?: Partial<Record<SheetDetent, string>> };
  children?: ReactNode;
}

function SheetRoot(
  {
    presentation = 'modal',
    position,
    surface = 'solid',
    dismissible,
    backdrop = false,
    containerHeight,
    bottomGap = SHEET_FLOAT_INSET,
    footer,
    androidKeyboardInputMode = 'adjustPan',
    stackBehavior = 'switch',
    open,
    animatedIndex,
    animatedPosition,
    onChange,
    onClose,
    onDismiss,
    animationConfigs,
    style,
    accessibility,
    children,
  }: SheetProps,
  ref: React.Ref<SheetRef>,
) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  /**
   * SEE: docs/explanation/bottom-sheet-system.md ("gorhom must be handed a ref OBJECT, never a callback ref"): with a callback ref
   * every `dismiss()` silently does nothing, so `ownRef` goes to gorhom and the caller gets a handle that delegates to it.
   */
  const ownRef = useRef<SheetRef | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (i: number, animationConfigs?: SheetAnimationConfig) => ownRef.current?.snapToIndex(i, animationConfigs),
      snapToPosition: (position: number | string, animationConfigs?: SheetAnimationConfig) =>
        ownRef.current?.snapToPosition(position, animationConfigs),
      expand: () => ownRef.current?.expand(),
      collapse: () => ownRef.current?.collapse(),
      close: (animationConfigs?: SheetAnimationConfig) => ownRef.current?.close(animationConfigs),
      forceClose: () => ownRef.current?.forceClose(),
      present: () => ownRef.current?.present?.(),
      dismiss: () => ownRef.current?.dismiss?.(),
    }),
    [],
  );

  useEffect(() => {
    if (open == null) return;
    if (open) ownRef.current?.present?.();
    else ownRef.current?.dismiss?.();
  }, [open]);

  const isModal = presentation === 'modal';

  /**
   * WHY: raised as soon as an animation heads for a detent, so a back press during the rise closes the sheet. Lowered only on index -1
   * or a dismiss, never by an animation's target: a content resize can animate toward a non-detent position and report -1 for a sheet that stays up.
   */
  const [up, setUp] = useState(false);
  const handleAnimate = useCallback((_from: number, to: number) => {
    if (to >= 0) setUp(true);
  }, []);
  const handleChange = useCallback(
    (i: number) => {
      setUp(i >= 0);
      onChange?.(i);
    },
    [onChange],
  );
  const handleDismiss = useCallback(() => {
    setUp(false);
    onDismiss?.();
  }, [onDismiss]);

  // QUIRK(android): back handlers run newest first, so a stacked sheet closes before the one under it and a screen's own handler waits until no sheet is up.
  // gorhom ignores the back button, so without this a press popped the screen behind the sheet.
  // WHY: every modal claims it, `dismissible` or not, since that prop governs the swipe alone; an inline sheet never does.
  useEffect(() => {
    if (Platform.OS !== 'android' || !isModal || !up) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ownRef.current?.dismiss?.();
      return true;
    });
    return () => sub.remove();
  }, [isModal, up]);

  // WHY: owning a pair when the caller supplies none gives the card's inset a source either way; the copies' frame of lag hides in the inset's few points.
  const ownIndex = useSharedValue(-1);
  const ownPosition = useSharedValue(0);
  const index = animatedIndex ?? ownIndex;
  const sheetTop = animatedPosition ?? ownPosition;

  /** WHY: at its top a page sheet reaches the container's top edge, not the top safe area, so the status-bar band is the page's and no map shows above it. */
  const pageAtTop = endsInPage(position);
  const box = containerHeight ?? windowHeight;
  const largeHeight = largeHeightOf(box, insets.top, pageAtTop);
  const glass = surface === 'glass' && GLASS_AVAILABLE;
  const resolved = useMemo(
    () => resolveSheetPosition(position, largeHeight, glass ? bottomGap : 0),
    [position, largeHeight, glass, bottomGap],
  );

  const canDismiss = dismissible ?? isModal;
  // QUIRK(gorhom-bottom-sheet): one pair of panning props both moves the sheet between detents and swipes it away, so a stuck sheet
  // that may be dismissed still pans; asking only "does it move" would silently drop swipe-to-dismiss from nearly every modal.
  const panning = resolved.movesBetweenDetents || canDismiss;

  const floatsStatically = glass && !resolved.attachesAtTop;
  /** WHY: a sheet stuck at `large` never leaves the attached state, so it takes the plain background rather than a GlassView covered at every frame. */
  const travels = glass && resolved.attachesAtTop && resolved.movesBetweenDetents;
  const cardKind: SheetCardKind = travels ? 'travelling' : floatsStatically ? 'floating' : 'attached';

  const announcedByHandle = accessibility !== undefined && panning;

  const renderBackground = useCallback(
    ({ style: bgStyle, pointerEvents }: BottomSheetBackgroundProps) => {
      const announces = !announcedByHandle;
      if (travels) {
        return (
          <ExpandableSheetBackground
            style={bgStyle}
            pointerEvents={pointerEvents}
            lastIndex={resolved.lastIndex}
            floatBottomGap={bottomGap}
            announces={announces}
            pageAtTop={pageAtTop}
            fillByIndex={resolved.fillByIndex}
          />
        );
      }
      if (floatsStatically) {
        return (
          <StuckSheetBackground
            style={bgStyle}
            pointerEvents={pointerEvents}
            bottomGap={bottomGap}
            announces={announces}
            fillByIndex={resolved.fillByIndex}
          />
        );
      }
      return (
        <AttachedSheetBackground
          style={bgStyle}
          pointerEvents={pointerEvents}
          announces={announces}
          lastIndex={resolved.lastIndex}
          pageAtTop={pageAtTop}
        />
      );
    },
    [travels, floatsStatically, resolved.lastIndex, resolved.fillByIndex, bottomGap, announcedByHandle, pageAtTop],
  );

  const stepDetent = useCallback(
    (step: 'increment' | 'decrement') => {
      const next = steppedDetentIndex(index.get(), resolved.lastIndex, step);
      if (next !== null) ownRef.current?.snapToIndex(next);
    },
    [index, resolved.lastIndex],
  );
  // WHY: read field by field, so a caller's fresh object each render keeps the handle mounted.
  const accessibilityLabel = accessibility?.label;
  const smallLabel = accessibility?.detentLabels?.small;
  const mediumLabel = accessibility?.detentLabels?.medium;
  const largeLabel = accessibility?.detentLabels?.large;
  const { stopLabels } = resolved;
  const handleA11y = useMemo<SheetHandleA11y | undefined>(() => {
    if (accessibilityLabel === undefined) return undefined;
    if (position.kind === 'stops') return { label: accessibilityLabel, detentLabels: stopLabels, onStep: stepDetent };
    const byName: Partial<Record<SheetDetent, string>> = { small: smallLabel, medium: mediumLabel, large: largeLabel };
    const names = position.kind === 'expandable' ? position.detents : [];
    return { label: accessibilityLabel, detentLabels: names.map((name) => byName[name]), onStep: stepDetent };
  }, [accessibilityLabel, smallLabel, mediumLabel, largeLabel, position, stopLabels, stepDetent]);

  // WHY: the grabber keeps its height while it fades, so gorhom's handle measurement is stable and the content does not jump.
  const fadingHandle = useAnimatedStyle(
    () => ({ opacity: sheetChromeAt(index.get(), resolved.lastIndex, pageAtTop).handleOpacity }),
    [resolved.lastIndex, pageAtTop],
  );
  const renderHandle = useCallback(
    ({ animatedIndex: handleIndex }: BottomSheetHandleProps) => {
      const handle = <SheetHandle a11y={handleA11y} animatedIndex={handleIndex} />;
      return pageAtTop ? <Animated.View style={fadingHandle}>{handle}</Animated.View> : handle;
    },
    [handleA11y, pageAtTop, fadingHandle],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        // WHY: the token carries the alpha, so gorhom's `opacity` of 1 means ramp all the way to the token's own value.
        opacity={1}
        style={[props.style, glass ? styles.scrimGlass : styles.scrim]}
      />
    ),
    [glass, styles],
  );

  /**
   * WHY: provided inside the content rather than around the sheet, because a modal's content is portalled and takes context from the portal host;
   * a solid sheet states `opaque` so one inside a glass sheet's content does not inherit glass.
   */
  const contentSurface = surface === 'glass' ? 'glass' : 'opaque';

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <SurfaceContext.Provider value={contentSurface}>{footer}</SurfaceContext.Provider>
      </BottomSheetFooter>
    ),
    [footer, contentSurface],
  );

  // SEE: docs/explanation/bottom-sheet-system.md ("Where each animated property lives") for why the side inset rides on the body as a margin.
  // QUIRK(react-native-reanimated): a prop an animated style once wrote stays on the native view after the style leaves the array,
  // so this is one animated style for every sheet, never swapped for a static one.
  const bodyInset = useAnimatedStyle(
    () => ({
      marginHorizontal: travels
        ? sheetChromeAt(index.get(), resolved.lastIndex, pageAtTop).sideInset
        : floatsStatically
          ? SHEET_FLOAT_INSET
          : 0,
    }),
    [travels, floatsStatically, resolved.lastIndex, pageAtTop],
  );
  const bodyStyle = [bodyInset, style];

  // WHY: a page sheet's `large` runs to the top edge, so its content clears the status bar through this spacer, less the grabber's row;
  // one UI-thread style, so a drag never round-trips through JS layout.
  const spacerHeight = pageSpacerHeight(insets.top, SHEET_HANDLE_HEIGHT);
  const pageSpacer = useAnimatedStyle(
    () => ({ height: spacerHeight * sheetPageRamp(index.get(), resolved.lastIndex) }),
    [spacerHeight, resolved.lastIndex],
  );

  const shared = {
    snapPoints: resolved.snapPoints,
    enableDynamicSizing: resolved.enableDynamicSizing,
    animatedIndex: index,
    animatedPosition: sheetTop,
    // WHY: a page sheet's handle always renders through `renderHandle`, which is what fades it.
    handleComponent: panning ? (accessibilityLabel === undefined && !pageAtTop ? SheetHandle : renderHandle) : null,
    // WHY: named sheets only, so every other sheet keeps gorhom's default.
    accessible: accessibility ? false : undefined,
    backgroundComponent: renderBackground,
    backdropComponent: backdrop ? renderBackdrop : undefined,
    footerComponent: footer != null ? renderFooter : undefined,
    enableHandlePanningGesture: panning,
    enableContentPanningGesture: panning,
    // WHY: spelled out, since gorhom's inline sheet defaults this to false and its modal to true.
    enablePanDownToClose: canDismiss,
    // WHY: gorhom rubber-bands past the top snap point by default; a card whose top detent is a fixed height must not ride past it,
    // since the map above is what that height is for.
    enableOverDrag: resolved.attachesAtTop,
    // WHY: `detached` and the floating background move together: that background assumes the box it is handed is the card.
    detached: floatsStatically,
    bottomInset: floatsStatically ? bottomGap : 0,
    android_keyboardInputMode: androidKeyboardInputMode,
    // WHY: an inline sheet is never up in the back-button sense, so it is spared the re-render each snap would cost.
    onChange: isModal ? handleChange : onChange,
    onAnimate: isModal ? handleAnimate : undefined,
    onClose,
    animationConfigs,
    style: bodyStyle,
    // WHY: gorhom's content container is an ordinary column (`BottomSheetBody`'s column-reverse puts the handle above it), so the spacer as first child sits at the top.
    children: (
      <SurfaceContext.Provider value={contentSurface}>
        <SheetCardClip kind={cardKind} lastIndex={resolved.lastIndex} pageAtTop={pageAtTop} floatBottomGap={bottomGap}>
          {pageAtTop ? <Animated.View style={pageSpacer} /> : null}
          {children}
        </SheetCardClip>
      </SurfaceContext.Provider>
    ),
  } as const;

  if (isModal) {
    return (
      <BottomSheetModal
        ref={ownRef as React.RefObject<BottomSheetModal>}
        {...shared}
        index={resolved.initialIndex}
        stackBehavior={stackBehavior}
        onDismiss={handleDismiss}
      />
    );
  }

  return (
    <GorhomBottomSheet
      ref={ownRef as React.RefObject<GorhomBottomSheet>}
      {...shared}
      index={resolved.initialIndex}
    />
  );
}

const SheetForwarded = forwardRef<SheetRef, SheetProps>(SheetRoot);
SheetForwarded.displayName = 'Sheet';

/** QUIRK(gorhom-bottom-sheet): sheet content registers with the draggable context only through gorhom's own scrollables, and one cannot nest inside another. */
export const Sheet = Object.assign(SheetForwarded, {
  View: BottomSheetView,
  ScrollView: SheetScrollView,
  FlatList: BottomSheetFlatList,
  SectionList: BottomSheetSectionList,
  Header: SheetHeader,
  CloseButton: SheetCloseButton,
  Handle: SheetHandle,
});

const useStyles = createThemedStyles(({ color }) => ({
  scrim: {
    backgroundColor: color.bg.overlay,
  },
  scrimGlass: {
    backgroundColor: color.bg.overlayMuted,
  },
}));
