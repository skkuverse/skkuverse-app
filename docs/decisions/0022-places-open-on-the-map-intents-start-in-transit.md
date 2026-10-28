---
title: Places Open on the Map, Intents Start in the Transit Tab
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Places Open on the Map, Intents Start in the Transit Tab

> Where a realtime line, a bus stop and future place features (bike stations, restaurants, building
> reviews) open, and what stays a full page. Read this before adding a screen that shows something
> with a location, or before changing the transit or map tab.

## Status

Accepted, 2026-10-23. Owner decisions amended decision 4 on 2026-10-24 and decisions 6 and 7 on
2026-10-27, and [ADR 0024](0024-rest-every-map-sheet-on-one-detent-scale.md) amended decision 3's
sheet heights. The text below reads as amended. The tab bar that makes one shared map possible is
[ADR 0023](0023-custom-tab-bar-with-glass-on-ios-26.md).

## Context

The server serves one page per bus stop (`GET /bus/stops/:stopId/arrivals`) and links each station
of a realtime line to it (`stopId` on `/bus/config`). The app has to decide where that page and the
line screens live. Two reference apps answer it in opposite ways:

| | Line screen | Stop screen |
| --- | --- | --- |
| Naver Map | Map on top, the station list in a sheet, scrolled to the nearest stop | Same map zoomed to the stop, the sheet swaps to the stop |
| Kakao Bus | Full-screen list, no map; a map button in the header | Map with the stop and an arrivals sheet |

Naver Map's tabs share one map: switching tabs keeps the map and the camera and swaps only the
sheet and the chips. The direction for our map tab is a Naver-style place platform: shuttles and
buses now, restaurants and building reviews later. Several entry points to one feature are fine.

## Decision

### 1. The transit and map tabs share one map

The transit tab and the map tab show the same map with the same camera. Home and notices stay
ordinary screens.

**Where the camera starts.** One rule for both tabs, applied on a cold start (a return from the
background keeps what the user was looking at): with location permission and the user near our
content (inside a campus radius, `campuses[].radiusM`, or within about 1 km of a served stop or
station), the camera starts at the user; otherwise it starts on the selected campus. A user at home
would see their own neighbourhood and nothing of ours. Opening the app never asks for permission;
the locate button does.

> [!NOTE]
> Paused (owner, 2026-10-24): location-based behavior waits until the basics are finished, to be
> polished in one go. Under the shared shell the cold start always opens on the selected campus:
> no start at the user, no silent campus switch (decision 5), and no ADR 0008 suggestion card. One
> switch turns it back on; the code and its tests stay. The locate button keeps working, and the
> native-tabs shell keeps its card. No location call may raise Android's system "turn on location"
> dialog.

What the two tabs share is decided by what an element is about:

| Kind | About | Shared |
| --- | --- | --- |
| World | The campus itself: the base map, the camera, the campus selection, the user's location, buildings and campus areas, the map controls (locate, layers, campus) | Yes |
| Task | What the user is doing in this tab: the sheet and its stack, the open line, the focused stop, the selected pin, the ADR 0008 suggestion card | No, per tab |
| Lens | How the world is filtered: chips and layers | By who turned it on |

A lens the user turns on (a layer from the layers control) is shared: it is their chosen view of
the world. A lens a task turns on (the open line's route and stops, the focus on a stop) belongs to
that tab and goes away with the task. The transit tab's own shuttle routes and stops show in the
transit tab only; the map tab gets them only from the layers control. While a task's sheet is open
its lens wins: a line's route shows even if the user switched that layer off, and closing the sheet
returns the user's setting.

**Chips run where their result shows.**

- A chip whose result is on the map (routes, the festival, later meals and bike stations) runs in
  the map tab. The transit tab's chip row is a billboard for the map tab: each chip there carries
  `opensIn: "map"`, and tapping it switches to the map tab and turns the chip on there, on top of
  whatever that tab had open, so ✕ returns to it. The shared camera keeps the place on screen, and
  the transit tab keeps its task.
- A chip whose result is in the transit list (a future mode or "running now" filter) would run in
  the transit tab (`opensIn: "transit"`). None exists yet; the campus filter is the selector, not a
  chip.
- Which chips the billboard shows is server data: `/map/config` chips carry `tabs`, and a chip
  without it shows in the map tab only. Not every map chip belongs on the billboard (lost and
  found, contact). Installed builds ignore `tabs` and `opensIn` and run every chip in the map tab.
- A chip is only ever on in the map tab, so no per-tab chip state is kept.
- A chip that leaves the app (web view, external link, mini app) is marked ↗, and one that switches
  tab or opens an in-app page is marked `›`. The app derives the mark from the action and
  `opensIn`; the server sends no icon.
- The billboard carries "shuttle routes" (the route-line layers, run in the map tab); festival and
  meals chips join it when they exist. The building-map, lost-and-found and contact chips stay
  map-tab only.
- The shuttle routes chip uses an action kind installed builds do not know, so they drop it rather
  than show it in their map tab. It cannot be a `focus` chip: that needs a `chipGroupId` on the
  route layers, and installed builds treat any grouped layer as festival content and hide the
  Jongno route toggles. The route layers keep `chipGroupId: null`, and `tabs` and `opensIn` ship in
  the same build, so no build runs a cross-tab chip in the wrong tab.

Three rules keep the shared map readable:

1. **An open task comes first.** While a line or a stop is open, shared places are dimmed or
   thinned so the route and its stops stay legible. Layers the user turned on are not dimmed.
2. **A sheet keeps its own camera within its stack; a tab switch never moves the camera.** Each
   sheet remembers the camera it last framed, and popping back to it (✕) restores that camera
   without animation. Switching tabs moves only the sheet (decision 3): the shared camera is what
   carries a place from one tab into the other. A sheet left open in the other tab can then sit
   over a camera that moved away from it; it frames its place again on request, as the line
   sheet's route control does. A locate press or a chip tap still waiting for its camera, inside
   ADR 0008's explicit-request window, outranks a restore: a pop or a tab switch that reveals a
   sheet leaves the camera alone, and the request stays pending (`decideRestore` in
   `apps/mobile/src/features/map/camera-request.rules.ts`). The user asked for that camera a moment
   ago. Restoring anyway made the GPS fix after a locate read as a sheet move, so the campus never
   switched.
3. **A pin opens where the user is.** Tapping a building pin in the transit tab pushes the building
   sheet onto the transit tab's sheet stack; the tab does not switch.

Search is world: one search in both tabs, finding stops, stations, buildings and places. A result
opens in the current tab's sheet stack, like a pin.

The top of the map is two rows. The first is the campus selector, both campuses visible, and beside
it one pill that groups two icon buttons, search and layers, as iOS groups toolbar buttons. Each
icon is its own button with its own accessibility label and a 44 pt target, and the pill follows
the glass rule of ADR 0023 decision 2. The second row is the chips. A full-width search field was
dropped: with location-based behavior paused, the selector is the only way to reach the other
campus, so it keeps its full width. Search opens a search screen whose placeholder names what it
finds. Revisit when location tailoring returns, using the search button's tap rate.

The first row always says what the map is showing, so it changes with the kind of state:

- **A lens keeps the top.** With a chip on, the selector, the pill and the chip row stay; the chip
  row shows the chip that is on. The user is still browsing, and campus, search and layers still
  apply.
- **A task replaces the top.** With a line, stop or place sheet open, the selector's place holds a
  search-styled field showing what is open (e.g. Jongno 07), which opens search to switch to another
  line or place. The layers button stays, and the chip row hides. Only the sheet header carries a
  ✕. At the sheet's full-page detent, the page's own top bar takes over and the map's first row hides.

### 2. Places and routes open as sheets; time and intents open as pages

| Feature | Opens as |
| --- | --- |
| Realtime line (HSSC, Jongno 02, 07, 08) | Sheet over the shared map |
| Bus stop, subway station | Sheet over the shared map |
| Bike station, restaurant, building review (later) | Sheet over the shared map |
| Timetable shuttle (campus, commute) | Full page |
| Taxi pooling (later) | Full page; only its meeting point links to the map |

A feature with a location the map can answer opens as a sheet. A feature that answers a time or an
intent ("when is the next one", "who is going my way") opens as a page, where the map adds nothing.
The transit cards themselves show nothing new.

Every place sheet swaps the body of the tab's sheet and joins its stack, the building sheet and the
festival event peek included. The native-tabs shell keeps them as floating cards.

Which tab carries a feature's chip is decided by where a user would look for it. Something you ride
belongs to the transit tab: bike stations are a transit chip, and their sheet is the same in either
tab. Something you look for belongs to the map tab: restaurants, building information, the
festival. Crowding goes with what is crowded: a station or a stop is transit; a street or a place
is the map.

### 3. A line sheet opens on one fixed default screen

Tapping a realtime line swaps the sheet to its station list, always on the same default screen:
the camera jumps without animation to fit the whole route, and the list opens at its first station.
The route fits, and a stop centres, in the visible map: the map minus the sheet at its opening
detent, the top controls and the tab bar. That padding is set once, when the sheet opens, through
the map SDK's content padding; it does not follow sheet drags.

Both directions are one continuous list, the first direction and then the second, with the route
line unbroken to the end. The direction tabs are a pinned scroll-spy: they switch as the list
scrolls into the other direction, and tapping one scrolls to it. Nothing in a line sheet depends on
the user's location, and opening a line never asks for location permission. Tailoring by location
(framing and centring the stop nearest the user) and nearby stops come later, as their own
decisions. The map draws the route line and the stops, **not** the buses: bus positions stay in
the list, and the sheet says so in one short line so an empty route does not read as broken.

The transit tab's root sheet opens expanded, its top just below the chip row, so the cards fill the
screen for the quick check while the campus selector and the billboard chips stay in sight. In the
map tab, tapping a chip lowers the sheet so the chip's result on the map shows. What the map shows
when the user pulls the transit sheet down is decided later, from how often users do (below).

Each tab remembers its sheet height for the session, and a cold start opens each at its default.
Switching between the transit and map tabs leaves the map and the camera alone and animates only
the sheet to the other tab's height (at most about 300 ms; instant with Reduce Motion), so the user
sees one map viewed two ways. A line sheet opens at `mid`, about 55% of the screen, so the whole
route fits the visible map above it; at 70% an iPhone 17 Pro kept only about 37 pt of map under the
top controls. Each sheet kind declares a profile: the levels of
[ADR 0024](0024-rest-every-map-sheet-on-one-detent-scale.md)'s scale it allows and the one it opens
at, with a page as its top level where it has one. A new place kind picks a profile instead of a
one-off layout.

Tapping a station swaps the sheet to the stop and zooms the camera on the same map. The route line
and its direction labels stay visible: a stop name often stands for two poles on opposite sides of
a road, and the line shows which side to stand on.

No sheet has a back arrow. Every sheet has one ✕: it returns to the previous sheet when there is
one, and otherwise closes the sheet. The Android back key does the same. A stop opened from a line
has the header `‹ name ›` with its toward label under the name, and ‹ › step through the line's
continuous order; a stop opened from outside a line (search, a pin, a link) has no ‹ ›.

The look follows NAVER Map's line screens, element by element, with the server field for each:

- The line sheet has a header (name and ✕, no favorite star), a row of chips (route info, marked
  ⓘ, and share; nearby stops comes later), the direction tabs from `/bus/config` `directions[]`,
  and the station list on one vertical line, with each bus on that line as an icon and its plate.
  Pass-through and drop-off-only stations are marked from `isPassThrough` and `isAlightOnly`,
  never from the station name.
- At the sheet's minimum, the map shows every stop pin of the route with its "toward" label, so a
  pin says which curb it is.
- A stop opened from a pin or a row enlarges its pin and keeps the route, its arrows and the
  neighbouring pins.
- At its top detent the line sheet becomes a full page: attached to the top safe area, with a
  compact pinned top bar (`name ✕`) and the direction tabs pinned, as NAVER Map does.

A field the server does not serve, such as a line's headway or a stop's first and last bus, is
added when the server serves it, never inferred in the app.

### 4. A stop is one pole, and its sheet renders entries by kind

A stop page is one pole with its direction label; two curbs are never merged into one place. The
stop sheet renders one row per `routes` entry by `kind` (`live`, `timetable`, an open enum) and
skips a kind it does not know. A stop such as the HSSC bus lot already mixes both kinds.

Stops are places: the same sheet opens from a line's station list, a map pin, search and a deep
link. The map tab lists no places; its first feature is the campus-to-campus directions PoC
(owner, 2026-10-24). Wherever it opens, a stop sheet draws the routes that serve that stop as its
own lens, so a stop found by search in the map tab still shows which side of the road it is on.
All eight served subway stations open as sheets the same way. A subway arrival under an hour away
shows minutes; an hour or more shows the clock time (arriving at 05:32, or the first train at
05:32). Saving a stop and saving a place are one "saved" list, not two.

### 5. One campus selection for both tabs

The transit tab gains the campus selector, and both tabs read the one selection the map tab keeps.
In the transit tab it filters the sections: a section tagged with a campus shows only while that
campus is selected, and an untagged section (the inter-campus shuttle) always shows, so the list is
all + Humanities or all + Natural Sciences. This replaces an earlier "order, never hide" rule. Its
risk is a card vanishing after the selection changed out of sight (a locate press in the map tab
switches it silently, per ADR 0008); the selector sits at the top of the transit tab, so the campus
the list follows is always on screen and one tap away. A camera move caused by opening a line, a
stop or a place never changes the selection, even for a place on the other campus opened from a
deep link or a search.

Hyehwa station belongs to Humanities. The commute shuttles, their stop stations and Sungkyunkwan
University station (in Suwon, beside the Natural Sciences campus) belong to Natural Sciences. The
server tags each section with its campus, so the app never reads section ids. The meals screen
keeps its own local campus.

[ADR 0008](0008-campus-camera-reconciliation.md) changes with this decision. Its campus suggestion
runs in the map tab only. A camera move caused by opening a line or a stop is an explicit action,
so it raises no card. Its "silenced for the session" state moves out of the hook into the shared
selection, so both tabs agree. And the selection follows the user once, at a cold start: when
decision 1's rule starts the camera at a user inside a campus, the selection switches to that
campus silently, as a locate press does, so the map and the filtered list agree from the first
frame. During use only the user changes it. While location-based behavior is paused, neither the
cold-start switch nor the card runs under the shared shell.

### 6. Timetable shuttles keep their screen

The campus and commute shuttles have no live positions and none is planned, so they stay pages. A
timetable's station rows (the subway transfer under its route map, and a run's transfer line) open
the station's sheet over the map as a place from a page (decision 7), and closing it returns to the
timetable. Under the native tabs, which have no map under a page, the row pushes the station's own
screen. Pins for the boarding spots wait until the realtime lines have been used.

### 7. Old routes keep working

The server-driven transit list sends `route` `/bus/realtime?groupId=…` for a realtime card. The app
redirects at the `/bus/realtime` route itself, not in the action handler, so every entry opens the
transit tab with the line sheet, and neither the server nor an installed build changes. Every
realtime line moved to the sheet at once: HSSC is the most used line, and leaving it out would
split the transit tab into two models and bias every measurement toward Jongno.

Home cards and deep links that should land with something open extend the existing place link
rather than adding a new one: `/map?place=[kind:]<id>&chip=<chipId>`, with the kinds `bus_stop:`
and `subway_station:` beside the existing ones, and `/transit?line=<groupId>` for a line. The same
`[kind:]id` is the stable id the "saved" list keeps. An installed build drops a place kind it does
not know and lands on the tab.

A push cannot use those shapes, because an installed build's notification handler drops a route it
does not list and falls back to the sending mini app. A push keeps its route (`/campus`) and
carries `chipId` and `placeId` as extra data keys, which installed builds ignore. During the 2026
festival four pushes went to plain `/campus` and landed users on a map with the festival chip off;
these keys are the fix.

A place opened from a page (taxi pooling's meeting point) opens in the tab its link names, and
without one in the place's home tab: a stop or station in transit, a building in the map. A page
that names itself as the place's origin (a campus route, a timetable) gets the place on the map tab
under it instead, so going back to the page does not switch tab. A page opened from home or notices
has no map tab under it: its place opens in the place's home tab, and the tab switches once on the
way there. The sheet stacks over whatever the user had open in that tab rather than replacing it.

The user's own close of that sheet (its ✕, the Android back key, a card's swipe) pushes the page
back as they left it, and back on it returns at once rather than first collapsing a raised sheet. A
sheet opened over it closes back to it, and a pin that replaces it keeps the page. A close the app
makes (a re-tap, a link replacing the task, a place that left the data) never returns. Leaving the
tab, for another tab, home, notices or a page pushed over the tabs, forgets the page, so a return
never crosses tabs, which is the cross-tab back this ADR rejects below. The ✕ stays a ✕. The
mechanism is in [shared-map.md](../explanation/shared-map.md).

Analytics: chip events carry `tab`, `ran_in` and `source` (`chip`, `portal`, `push`, `deeplink`,
`home`); tab switches carry their `cause`. The measure for a cross-tab chip is how often a user
returns to the source tab within 30 seconds.

### 8. The map tab keeps its name

The tab stays 지도, Map in English. <!-- conventions:allow-korean: the tab label -->
It was renamed from "campus" after festival feedback that "campus" did not say what was there, and a
user looking for a restaurant or a building still reaches for "map" first. Naver names its tabs by
task because every tab is a map; ours sits beside home and notices, which are not, so the map name
still tells the tabs apart.

The cost is that the transit tab shows a map too. What each tab shows on opening answers that, not
the name: the transit tab opens on its shuttle cards and transit chips, the map tab on the buildings
around where decision 1's rule starts the camera, with its place chips. If the transit-to-map
switch rate or the map tab's open-and-leave rate says otherwise, the label is an OTA away.

## Consequences

### Server contracts

The app reads `GET /bus/stops` (every stop with its coordinates, campus and routes; the line sheet
joins `/bus/config` `station.stopId` to it), the route lines on `/map/overlays/transit`, and the
fields the decisions above name. Each ships on skkuverse-server before the app OTA that reads it,
and data that shows a chip with `tabs: ["transit"]` waits until most installs read `tabs`. A subway
station's `coords` is nullable, so the subway screen never fails for want of it, and one list of the
stations with coords serves the map pins (one request, not eight).

### Costs

- The map is rendered at launch, not on the first visit, so a line opens as fast as a list would.
  Users who never open either tab pay its memory; [ADR 0023](0023-custom-tab-bar-with-glass-on-ios-26.md)
  measures it.
- **Not decided here:** decision 6's deferred part. The line sheet's opening height (about 55%) is
  revisited with the full-height measurement below.

### Measuring it

Record how often a line sheet is expanded to full height. If most users expand it at once, the map
is not wanted on that screen and the initial height changes. For the transit tab's root, record how
often users pull the sheet down to the map: it decides what the transit map shows by default, and
whether the root opens lower. Record the time from opening the app to the first card tap as well,
so the cost to the quick check stays visible.

### Alternatives considered

- **List first, map on a button (Kakao Bus).** Fastest glance, no map cost. Rejected: it keeps
  transit and the map apart, against the map tab's direction, and a full-height sheet already gives
  the list view.
- **The map tab hosts every sheet; a transit card switches tabs.** The first version of this ADR.
  Rejected: the back gesture has to cross tabs, opening a line overwrites what the map tab was
  showing, and the camera move fights ADR 0008.
- **The line in the transit tab, the stop in the map tab.** Rejected: the stop opens on a different
  map, so the route line and its direction vanish exactly where the user needs them.
- **Two map instances with a synced camera.** The fallback if ADR 0023's single map fails its
  prototype: the same experience at twice the map memory.
- **No map at all.** A session under a minute may be a success. Still the strongest objection; the
  full-height measurement above is how it gets tested.

## Related

- skkuverse-server `docs/reference/bus-stops-api.md`: the stop page contract
- [ADR 0008](0008-campus-camera-reconciliation.md): the campus toggle and the camera
- [ADR 0020](0020-app-architecture.md): module shape for the new screens
- [ADR 0023](0023-custom-tab-bar-with-glass-on-ios-26.md): the custom tab bar and the shared map
- [shared-map.md](../explanation/shared-map.md): how the code carries these decisions out
