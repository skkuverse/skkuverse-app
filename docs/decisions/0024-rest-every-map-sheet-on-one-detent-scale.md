---
title: Rest Every Map Sheet on One Detent Scale
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Rest Every Map Sheet on One Detent Scale

> Why every sheet on the shared map rests at the same four levels, `min`, `mid`, `max` and `page`,
> what sizes them, what a sheet kind still chooses, and what each level looks like. Read this before
> adding a sheet kind to the map or changing a sheet's height. It amends
> [ADR 0022](0022-places-open-on-the-map-intents-start-in-transit.md) decision 3.

## Status

Accepted, 2026-10-24, by the owner. The shared-map shell adopts it in full. The native-tabs shell
keeps its campus sheet's heights until the owner signs off on the changes listed under
[Consequences](#what-the-native-tabs-shell-still-has-to-take), and retires with that shell
otherwise.

## Context

By 2026-10-24 the map's sheets rested at eight different sets of heights. Each sheet kind named
SDS's `small`, `medium` and `large` and overrode the first two. The campus root used two
percentages and This week on campus a measured peek. The transit root stopped at the bottom of the
top controls, a line and a stop had percentages of their own, and the building, the event place
and the chip list inherited the root's. That arrangement caused these problems:

- SDS's `large` means "attached to the top safe area". On the map no sheet should attach there,
  because the campus selector and the chips sit above it. A building sheet that opened at
  `large` covered the controls it was opened from.
- A sheet kind that named no heights inherited the root's, so the same kind rested at different
  heights depending on which root it was pushed over.
- Each view snapped its own sheet open. A pop that revealed a body and that body's opening snap
  ran in one commit, and gorhom kept one of the two. A line at its page under a stop came back at
  the line's opening, or closed.

## Decision

### 1. One scale of four levels

Every map sheet rests at levels of one scale, `MapDetent`
(`apps/mobile/src/features/map/sheet-detents.constants.ts`):

| Level | Where the sheet's top rests |
| --- | --- |
| `min` | The handle and a fixed body (`MIN_BODY_PT`) above the tab bar's clearance |
| `mid` | A fixed share of the container (`MID_PERCENT`), where every live line's whole route fits above the sheet |
| `max` | Just under the top controls of the sheet's chrome (the campus selector and chips, or the task field) and the NAVER logo hung under them |
| `page` | The whole container, as a page of its own |

`max` leaves the NAVER logo's band uncovered (amended 2026-10-25). The logo hangs top-left under
the controls, and NAVER's terms forbid covering it, so no level short of the page may reach it.

`min` is a body in points rather than a share of the screen, so a taller phone shows the same rows
rather than more map. Its size reproduces the campus sheet's old floor on the reference phone,
where most users rest. `max` is arithmetic over the top chrome's fixed heights, so it is known in
the first commit. A level stands in as a share of the container until its inputs are known.

SDS keeps `small`, `medium` and `large` for the window modals, where "attached" is the right
meaning. The map resolves its levels into covered heights and hands SDS a `stops` position.

### 2. A sheet kind chooses levels, never heights

A sheet kind names a profile (`MAP_SHEET_PROFILES`), which chooses the levels it allows and the one
it opens at. No profile carries a height.

| Kind | Levels | Opens at |
| --- | --- | --- |
| Campus root | `min`, `mid`, `max` | `min` |
| This week on campus root | `min`, `mid`, `max` | `mid` |
| Transit root | `min`, `mid`, `max` | `max` |
| Line | `min`, `mid`, `page` | `mid` |
| Stop, station | `min`, `mid`, `max` | `mid` |
| Building | `min`, `mid`, `max` | `max` |
| Event place | `min`, `mid`, `max` | `min`, or `max` for a pin that names only an area |
| Chip list | `min`, `mid`, `max` | `mid` |

A line skips `max`: its top is a page, and a level just under the task field would add a rest
that shows neither the route nor the page. The transit root gains `mid`, a rest between the cards
and the map. This week on campus opens at `mid` instead of a peek measured from its content, so it
moves with the scale.

### 3. Levels are names, and one rule moves the sheet

Code reads levels by name everywhere but at gorhom. One module converts a gorhom index into a name
and back (`sheet-detents.rules.ts`), and a worklet reads per-index tables built there.

No view snaps its sheet. After each commit one rule decides where the sheet goes
(`decideSheetMove`). A body just pushed opens at its recorded level, and a body or the root that a
pop reveals returns to its own. A level written by someone else is followed. Nothing else moves the
sheet. When the snap points changed in the same commit, the move waits one frame, as the tab switch
already did.

### 4. Glass at the lower levels, solid at the top

Every map sheet is glass at `min` and `mid`, where the map shows around it, and solid at `max` and
`page`. The fill ramps continuously while the sheet is dragged between `mid` and `max`. The glass
stays mounted and an opaque fill fades in over it. Android and iOS before 26 stay opaque at every
level. Content keeps the rules for a glass sheet at every level.

A tab root is drawn under the floating tab bar. Anything opened from it is drawn over the bar.
That layering never decides the surface.

### 5. What decision 3 of ADR 0022 now says

ADR 0022 decision 3 set the line sheet's opening height and asked each sheet kind for a profile of
its own detents. Both stand, read through this scale: the line opens at `mid`, and a profile
chooses levels rather than heights. The rest of ADR 0022 decision 3 is unchanged.

## Consequences

### What users of the shared map see

Measured against the heights before this decision:

- A stop or a station opens higher, at `mid`, and its `max` stops under the task field instead of
  attaching at the top.
- A building opens under the campus selector and the chips instead of over them.
- A line lowered to `min` shows its header alone, a little lower than before.
- The chip list opens at `mid`, higher than the campus sheet's old middle.
- The transit root has a third rest, `mid`.
- A sheet raised to `max` turns solid. At `min` and `mid` it stays glass.

### Costs

- The native-tabs shell keeps a second path: its campus sheet and chip list read the same profiles
  over SDS's old position (`toLegacyStops`), and golden fixtures pin that output. Both go when the
  native shell moves to the scale or retires.
- Analytics changed meaning on this date. `line_sheet` `expand` and `transit_root` `collapse` carry
  level names instead of SDS's, and a transit root pulled to `mid` now counts as a collapse
  ([analytics.md](../explanation/analytics.md)).
- `min` depends on the tab bar's overlap, which the shell reports a layout after the sheet mounts.
  It holds a stand-in until then.

### What the native-tabs shell still has to take

The native shell moves only after the owner signs off on what it changes for store users:

1. The campus root's top becomes a floating card under the chips instead of an attached,
   full-height sheet.
2. The campus sheet's middle moves to `mid`.
3. The chip list opens at `mid`.
4. Under the JS tab bar (Android, iOS before 26), `min` is computed from a smaller clearance and
   rests lower than its old percentage. This is unverified per device.
5. Gorhom's `detached` mode flips at run time on the native map tab, from the glass root to the
   solid list, for the first time.

That step deletes the legacy path and needs an Android pass on a device.

## Alternatives considered

- **Four SDS names, or three with overrides.** Rejected: `large` means attached, which no map level
  but the page is, and overrides are how the eight sets of heights grew.
- **One constant `max` for every chrome.** Rejected: the task field is one row shorter than the
  world's controls, so a constant either covers the chips or leaves a gap under the task field.
- **Measuring the top controls for `max`.** Rejected for arithmetic over the controls' fixed
  heights, which is known before layout. A development build checks it against the measured edge.
- **Per-view opening snaps beside the profile.** Rejected: two snaps in one commit leave the
  outcome to gorhom.
- **Storing gorhom indices.** Rejected: an index means a different level once the levels change
  under the same sheet.
- **The map subtracting the floating card's gap.** Rejected: SDS decides when a card floats, so it
  owns the gap.

## Related

- [ADR 0022](0022-places-open-on-the-map-intents-start-in-transit.md): the decision this amends
- [ADR 0023](0023-custom-tab-bar-with-glass-on-ios-26.md): the shared map and the tab bar
- `apps/mobile/src/features/map/sheet-detents.rules.ts` and `sheet-stack.constants.ts`: how the
  code carries it out
- [bottom-sheet-system.md](../explanation/bottom-sheet-system.md): why SDS sheets are built the way
  they are; the `stops` position lives in `packages/sds/src/components/sheet/detents.ts`
