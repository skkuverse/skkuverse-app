# Transit line sheet

A rider opens a bus or shuttle line and sees its sheet on the transit tab's shared map: the line's stops and its live or scheduled buses, with the route drawn on the map.

## Sub-features

- `line-link` opens a line's sheet from `skkuverse:///transit?line=<groupId>`.
- `line-tab` opens the same sheet by tapping the line on the transit tab.
- `line-back` closes the sheet and returns to the transit tab's list.

## How to get to it (user POV)

- Tap a shared link or a notification for a line.
- Open the transit tab (the fourth tab) and tap a line in its list.

## Driving it with verify-mobile

Preconditions:

- Baseline preconditions hold.
- A line ID from the live list: `curl -s https://api.skkuverse.com/bus/config | jq -r '.data.groups[].id'`. `hssc` is the Humanities campus shuttle.

- **Open by link.** Run `.claude/skills/verify-mobile/scripts/link.sh 'skkuverse:///transit?line=hssc'`. The line's sheet opens at full height, titled with the line's name, listing its stops with live bus positions.
- **Proof of the link path.** Run `shot.sh .verify/<run-id> line-link`. The screenshot shows the sheet title and the stop list.
- **Close.** Find the close button with `ui.sh` (its label is the Korean word for close, at the sheet's top right) and `axe.sh tap` its point. The transit tab's list of lines shows again.
- **Open by tap.** Find the line's row with `ui.sh` (its label starts with the line name the sheet showed) and tap it. The same sheet opens at the middle detent, with the route and stops drawn on the map above it.
- **Proof of the tap path.** Run `shot.sh .verify/<run-id> line-tap`. The screenshot shows the route on the map and the sheet below it.
- **Console.** Run `node .claude/skills/verify-mobile/scripts/console.mjs 3 .verify/<run-id>/console.txt` and check it holds no error from the transit feature.

## Gotchas

- A malformed `line` value is not an error: the link just opens the transit tab with no sheet.
- Buses only show while the line runs. Outside its hours the sheet shows the timetable or a not-running state; that is not a regression.
- Realtime positions refresh every few seconds, so two screenshots of the same state differ.
- The link opens the sheet at full height and the tap opens it at the middle detent. Compare each entry point with its own screenshot, not with the other's.
