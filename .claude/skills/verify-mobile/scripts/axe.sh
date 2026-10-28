#!/bin/bash
# Run AXe (the simulator UI driver bundled with XcodeBuildMCP) against the booted iOS 26 simulator.
# Coordinates are points, as `describe-ui` reports frames, not screenshot pixels.
# Usage: .claude/skills/verify-mobile/scripts/axe.sh tap -x 200 -y 600
#        .claude/skills/verify-mobile/scripts/axe.sh swipe --start-x 201 --start-y 520 --end-x 201 --end-y 200 --duration 0.5
#        .claude/skills/verify-mobile/scripts/axe.sh describe-ui
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
axe=$(command -v axe || true)
if [ -z "$axe" ]; then
  axe=$(find "$HOME/.npm/_npx" -path '*xcodebuildmcp/bundled/axe' -type f 2>/dev/null | head -1)
fi
if [ -z "$axe" ]; then
  echo "AXe not found: install it (brew install cameroncooke/axe/axe) or run any XcodeBuildMCP tool once so npx caches its bundled copy" >&2
  exit 1
fi
exec "$axe" "$@" --udid "$("$here/sim-udid.sh")"
