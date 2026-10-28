---
title: The bottom sheet system
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# The bottom sheet system

> Why SDS `Sheet` (`packages/sds/src/components/sheet/`) draws, moves and closes as it does, and
> the pin and patch on `@gorhom/bottom-sheet`. Read it before changing a sheet's chrome or bumping
> gorhom. The positions are typed in `detents.ts` and the numbers live in `chrome.ts`.

## The rule that decides the surface

**A card is glass while it floats and opaque once it attaches.** `large` attaches, and in a `stops`
position only a `page` top does. Whether the sheet can be dragged decides only whether that change
is animated: "glass on draggable sheets" would make two sheets of one height differ for a reason the
user cannot see. `surface="glass"` is opt-in. It pays over a live map and is noise over a list.

A card that keeps one shape uses gorhom's `detached` mode, which makes the body's box the visible
card. `detached` is static, so only a glass sheet that floats low and attaches at the top computes
its card per frame, as one continuous function of `animatedIndex` that tracks the finger. A stop's
`fill` lets a card that never attaches still turn solid under the controls above it. The fill,
radius and shadow belong to the `backgroundComponent` and the handle is the grabber alone:
`BottomSheetScrollView` fills the content box, so a fill there hides the card, and an opaque handle
on a translucent card reads as a lid.

## gorhom must be handed a ref OBJECT, never a callback ref

`BottomSheetModal.present()` queues **the forwarded ref itself**, and the provider closes it with
`queued.ref?.current?.dismiss()`. A callback ref, which merging the caller's ref with an internal
one produces, has no `.current`, so every `dismiss()` and `restore()` silently does nothing, while
the provider's `dismiss()` still returns `true` because it found the queue entry. So `Sheet` hands
gorhom a ref object of its own and gives the caller a `useImperativeHandle` that delegates to it.

## Glass cannot be faded out, only covered

`opacity: 0` on a `GlassView`, or on any ancestor, does not fade the effect; it stops it rendering
(Expo documents this). So the glass stays at full opacity and an opaque sibling fades in over it, a
stop's `fill` included, and the frame carrying the card's geometry and shadow **never takes an
animated opacity**. gorhom's body is a Reanimated view ([MOTION-04](../reference/design-usage.md#motion-04));
its style moves the body without fading it, and the glass renders, which was checked by looking, not
reasoned. A new glass surface under a Reanimated parent needs the same look.

## The glass rounds itself

`expo-glass-effect` maps `borderRadius` and each per-corner radius onto UIKit's
`cornerConfiguration`. Never shape glass with a rounded `overflow: 'hidden'` parent. The clip cuts a
square effect and slices the specular edge line at four points. Its mask takes the shadow too.

## What may sit on the card

The geometry ramps across the whole travel but the fill only over the final segment, so every
detent below the top is glass over a moving map:

- **A block that needs a fill paints a colour of its own, never the layer.** The sheet is the layer,
  so a `bg.layerDefault` or `bg.layerFloating` on it is an opaque white block on the glass
  ([COLOR-12](../reference/design-usage.md#color-12), `useSurface()` in [SDS.md](../../packages/sds/SDS.md)).
- **Content is not branched on the detent.** A branch needs a wrapper with an animated opacity,
  which must never become an ancestor of a `GlassView`. A block legible on glass is cheaper.
- **No block, nor `Sheet`'s content wrapper, carries a horizontal gutter.** The card's inset
  animates, so a baked-in gutter is measured from a moving edge. The caller pads the column once.
- **No `WebView`.** It paints an opaque background, a solid rectangle in a translucent card;
  long-form content goes behind a `webview` or `miniapp` action that opens a full screen.

## The bottom gap is not the side gap

A floating card's bottom gap is measured from its own container: an inline sheet's is the host
screen's root view, a portalled modal's is the whole window. A gap chosen locally, such as the safe
area, sits visibly above the card behind it. So the map host restates the inline card's bottom edge
in the modal's coordinates as one `bottomGap` for every modal, and the cards share one bottom line.
`bottomGap` moves the card, so it cannot clear a tab bar floating over the content, which pads past
the bar instead. `bottomInset` also shrinks the container a percentage detent resolves against.

## Where each animated property lives

The height and corner radii animate inside `ExpandableSheetBackground`, on a childless leaf, so a
frame costs one view's layout. The side inset is a margin on the sheet body's own `style`, because
gorhom composes its absolute positioning after the supplied style and wins any `left` or `right`.
The inset moves the background, handle and content as one unit: insetting the background alone
leaves strips beside the card that look like map but belong to the sheet's scroll view, so a drag
there moves the sheet. The price is a layout commit on the sheet subtree per frame, accepted because
gorhom's content view already animates its `height` and `paddingBottom` every frame of a drag; the
escape is to freeze the geometry below the middle detent, where it barely changes.

### Read gorhom's position, not the copy

The card's top edge is the body's `translateY`, driven by gorhom's internal `animatedPosition`, and
its bottom edge is a height computed from a position, so both must read the same shared value. The
`animatedPosition` and `animatedIndex` a caller hands `Sheet` are copies filled in a
`useAnimatedReaction`, which Reanimated does not order before a style that reads them, so on a drag
the bottom edge shakes. Everything inside the sheet that tracks the card's edges reads
`useSheetMotion()`; the copies are for outside the sheet, where gorhom's provider does not resolve.

## The campus sheet steps aside for a detail sheet

A modal card rising over an inline sheet still showing reads as two sheets stacked: a second grab
handle in the same band, the list half-covered. So the inline sheet closes first, the modal waits
for gorhom's closed report, and the inline sheet returns to its detent when the modal goes. Both
moves are short timings, since gorhom's spring read as a pause between the tap and the answer. The
decisions are `apps/mobile/src/features/map/sheet-handoff.rules.ts`. The filter sheet stays out on
purpose: it floats beside the campus card, and closing the card would leave it over an empty map.

## The gorhom pin and its patch

`@gorhom/bottom-sheet` is pinned exact in `apps/mobile/package.json`, boxed in from both sides:

- **Below:** React Native 0.85 removed `StyleSheet.absoluteFillObject`, which gorhom's hosting
  container read as `undefined`, so every sheet measured zero tall and opened, reporting its index,
  with nothing drawn. The floor is the release carrying gorhom/react-native-bottom-sheet#2637.
- **Above:** the modal changes that followed (gorhom/react-native-bottom-sheet#2655,
  gorhom/react-native-bottom-sheet#2632) break two things silently. A modal dismissed before it was
  ever presented is wedged and never renders again (gorhom/react-native-bottom-sheet#2669), and
  `Sheet`'s `open` prop dismisses on mount when it starts closed, which is how the mini-app shell's
  ⋯ sheet stops opening. And the default `switch` stack unmounts the sheet below instead of hiding
  it, so closing a building detail opened over a place peek does not bring the peek back.

Raise the pin only once a release fixes #2669 and `switch` brings the lower sheet back, and re-check
both paths on a device. The patch in `patches/` is named for the pinned version, so a bump
regenerates or drops it in the same change, checking each hunk against the new release:

- **The scroll lock re-enters itself.** `useScrollEventsHandlersDefault` locks a scrollable with
  `scrollTo(ref, 0, lockPosition)`, which on Fabric fires a scroll event synchronously back into
  the same handlers until the native stack overflows, fatal in a release build's worklet. A flag on
  the handlers' shared context drops a lock raised from inside its own `scrollTo`. Drop the hunk
  once gorhom/react-native-bottom-sheet#2737 or a release bounds the lock.
- **A drag clamped onto the lowest detent settles there.** With `enablePanDownToClose` off and no
  over-drag, the release targets where the sheet already is, so gorhom returned without animating,
  kept the detent the drag started at and never fired `onChange`. The hunk drops the gesture's
  early return and makes `animateToPosition` set the index and report it for a sheet already at a
  detent. Drop it once upstream settles a clamped release.
- **A snap resolves its index on the UI thread.** Upstream `snapToIndex` turns the index into a
  position on the JS thread, while gorhom recomputes its detents on the UI thread after a snap point
  change or a `bottomInset` relayout, so a snap issued around one files the sheet under -1 at a
  replaced position (a map root rested at the top of the screen). The hunk resolves the position in
  a worklet right before animating, a later change retargets a running snap by index
  (`evaluatePosition`), and the JS side keeps only the index check's lower bound.
