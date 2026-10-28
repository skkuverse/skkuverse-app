# glass-tabs

The shared-map shell's floating tab bar (ADR 0023), vendored from `expo-glass-tabs` and reworked
for this app, with Instagram's iOS 26 tab bar as the reference. It is ours now: change it freely,
and keep the attribution below.

## Upstream

- `expo-glass-tabs` 0.1.1 by David Mokos, MIT. `LICENSE` in this folder is its notice, and every
  file derived from it says so in its header.
- Source: <https://github.com/davidmokos/expo-glass-tabs>, commit `f6119a19` (2026-07-22, the
  commit the 0.1.1 tarball was built from).
- Vendored on 2026-10-24, when the npm dependency was removed. `scripts/check-singletons.mjs` no
  longer sees it, and nothing else in the tree imports it.
- The in-app open-source licences screen lists it through the hand-kept `VENDORED` entry in
  `apps/mobile/scripts/generate-oss-licenses.mjs`, since that script walks `node_modules`.

## What is here, against upstream

| Upstream file | Here | What changed |
| --- | --- | --- |
| `src/glass-tab-bar.tsx` | `GlassTabBar.tsx` | The geometry comes from `tabBarGeometry`, the colours are SDS roles, the glass is light (`colorScheme` from the app's resolved scheme) with no tint; icon-only, the label is the cell's accessibility label; the shrink is one `scale` transform on the capsule about its centre instead of per-frame `height`, `marginHorizontal` and `borderRadius`; the lens has a leading and a trailing edge, so it stretches with speed, and is a transform too; a press swells the capsule; a scrub back to its start tab selects nothing, a drifted tap still selects; a focus change expands the bar; the tap gesture is gone, so a tap reaches the cell's pressable alone and one touch presses once; the cells are SDS `Pressable`; the tick goes through `platform/haptics.ts` |
| `src/minimize-context.tsx` | `apps/mobile/src/components/useTabBarMinimize.tsx` and `tab-bar-minimize.rules.ts` | Moved beside `useTabBarInset`, because a feature's list drives it and no feature imports `bootstrap/` (ADR 0020 D2). The scroll decision is a pure rule with a test; `useMinimizeOnScroll` takes a `topInset` for a page whose offset rests below zero; the spring is Instagram's (0.4s at damping 0.75) instead of critically damped |
| `src/progressive-blur.tsx` | removed | The dark edge blur and gradient darkened the bottom 120pt of white pages; Instagram's bar floats over the content with no scrim |
| `src/fading-tab-slot.tsx` | removed | Its screen and fade views took every touch over the shared map; the shell keeps its own slot (`SharedMapShell.tsx`) |
| `src/index.ts` | removed | ADR 0020's file vocabulary has no barrels; consumers import `GlassTabBar.tsx` and `geometry.rules.ts` directly |
| (none) | `geometry.rules.ts` | One pure function of the safe-area insets and window width: the capsule frame, the inset a page clears, the hit cells, the lens, the glyph offsets and the minimized scale. The frame is UIKit's iOS 26 bar as Liquidum measured it (recovered from commit 910d929d); `indexAtX` is upstream's idea on the lens pitch instead of an equal share, since these lenses overlap |
| (none) | `lens.rules.ts` | The two-edge lens span and what a scrub's release selects |

The pure files have tests beside them (`geometry.rules.test.ts`, `lens.rules.test.ts`, and
`tab-bar-minimize.rules.test.ts` under `components/`). What the shell adds around the bar (the
inset it reports, the accessory, the badge, a re-tap, the Android back key) is `SharedMapTabBar.tsx`
and `tab-bar.rules.ts` one folder up; the glyphs both shells draw are `tab-icons.constants.ts`
there; and the mechanism as built is `docs/explanation/shared-map.md`.
