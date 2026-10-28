#!/bin/bash
# Save a simulator screenshot as evidence. The directory is created if missing.
# Usage: .claude/skills/verify-mobile/scripts/shot.sh .verify/<run-id> <name>   -> .verify/<run-id>/<name>.png
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=${1:?evidence directory}; name=${2:?file name without extension}
mkdir -p "$dir"
xcrun simctl io "$("$here/sim-udid.sh")" screenshot --type=png "$dir/$name.png" >/dev/null 2>&1
echo "$dir/$name.png"
