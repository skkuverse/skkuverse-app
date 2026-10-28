# Notice detail

A student opens a university notice from a shared link or a push notification, reads it, and goes back to the notices tab.

## Sub-features

- `notice-link` opens a notice's detail from `skkuverse:///notices/<sourceId>/<articleNo>`.
- `notice-back` returns from the detail to the notices tab.
- `notice-gate` shows the onboarding landing on the notices tab for a signed-out user.

## How to get to it (user POV)

- Tap a shared notice link or a notice push notification.
- Open the notices tab (the second tab). A signed-out user sees the onboarding landing; an onboarded user sees the feed and taps a row.

## Driving it with verify-mobile

Preconditions:

- Baseline preconditions hold.
- A current notice: `curl -s https://api.skkuverse.com/notices/source/skku-main | jq -r '.data.notices[:3][] | "\(.articleNo) \(.title)"'`.

- **Open by link.** Run `.claude/skills/verify-mobile/scripts/link.sh 'skkuverse:///notices/skku-main/<articleNo>'`. The notices tab is selected and the notice detail is pushed over it, showing the notice title and body.
- **Proof.** Run `shot.sh .verify/<run-id> notice-link`. The title on screen matches the title from the API.
- **Back.** Use the back button (an element ref in the native header) or swipe from the left edge. The notices tab shows; signed out, that is the onboarding landing.
- **Gate.** Screenshot the notices tab while signed out (`notice-gate`).

## Gotchas

- Tapping a feed row needs an onboarded user, which needs Google sign-in with a school account: a person's step. Signed out, drive the link path only and report the row tap as not driven.
- Old article numbers can be removed from the source; pick a current one from the API every run.
- Images in a notice load lazily. Wait before the screenshot if the body shows placeholders.
