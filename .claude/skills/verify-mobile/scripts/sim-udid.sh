#!/bin/bash
# Print the UDID of the booted iOS 26+ iPhone simulator. Exit 1 when none is booted.
# Usage: .claude/skills/verify-mobile/scripts/sim-udid.sh
set -euo pipefail
udid=$(xcrun simctl list devices booted -j | python3 -c '
import json, sys
devices = json.load(sys.stdin)["devices"]
for runtime, items in devices.items():
    major = runtime.rsplit("iOS-", 1)[-1].split("-")[0]
    if "iOS-" in runtime and major.isdigit() and int(major) >= 26:
        for d in items:
            if d["state"] == "Booted" and d["name"].startswith("iPhone"):
                print(d["udid"]); sys.exit(0)
')
if [ -z "$udid" ]; then
  echo "no booted iOS 26+ iPhone simulator; boot one: xcrun simctl boot \"iPhone 17 Pro\" (pick the iOS 26 device from 'xcrun simctl list devices')" >&2
  exit 1
fi
echo "$udid"
