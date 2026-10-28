#!/bin/bash
# Open a deep link in the app on the booted iOS 26 simulator, the way a tapped link arrives.
# Usage: .claude/skills/verify-mobile/scripts/link.sh 'skkuverse:///transit?line=hssc'
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
perl -e 'alarm 30; exec @ARGV' xcrun simctl openurl "$("$here/sim-udid.sh")" "${1:?deep link}"
