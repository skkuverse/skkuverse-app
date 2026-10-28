# Campus map place

A visitor finds a campus building on the shared map and opens its detail sheet: name, number, and what is inside. The map's chip row narrows which layers are drawn.

## Sub-features

- `place-link` opens a building's sheet from `skkuverse:///map?place=skku_building:<placeId>`.
- `place-tap` opens it by tapping the building's numbered marker on the map.
- `chip-select` applies a chip from the row above the map, and `chip-clear` removes it.

## How to get to it (user POV)

- Tap a shared place link.
- Open the map tab (the third tab), find the building, and tap its number.
- Tap a chip in the row at the top of the map, then its clear control.

## Driving it with verify-mobile

Preconditions:

- Baseline preconditions hold.
- A building place ID from the live overlays: `curl -s https://api.skkuverse.com/map/overlays/campus | jq -r '.data.overlays[] | select(.layerId=="building_numbers") | "\(.tap.placeId) \(.campus) \(.text.en)"' | head`. Place `2` is building 1 on the Humanities campus.

- **Open by link.** Run `.claude/skills/verify-mobile/scripts/link.sh 'skkuverse:///map?place=skku_building:2'`. The map tab opens, the camera moves to the building, and its detail sheet rises.
- **Proof of the link path.** Run `shot.sh .verify/<run-id> place-link`. The screenshot shows the sheet with the building's name and number.
- **Open by tap.** Close the sheet, then tap the building's numbered marker. Markers are native map overlays with no accessibility label: find the marker on a screenshot, divide its pixel position by 3 for points, and `axe.sh tap` it. The same sheet opens.
- **Chips.** Find a chip in the row above the map with `ui.sh` (chips are buttons labelled with their text), tap it, and screenshot the narrowed map. Tap the clear control and screenshot again.

## Gotchas

- `snapshot_ui` does not return on the map screen. Use screenshots and `describe-ui`.
- Festival layers only draw inside their time windows. An empty festival layer outside them is not a regression.
- The campus toggle never moves by itself. Opening a building on the other campus offers a card instead of switching; that is intended.
- A building on a campus the camera is not over animates there first. Wait for the camera to settle before the screenshot.
