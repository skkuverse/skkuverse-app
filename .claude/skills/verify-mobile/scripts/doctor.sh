#!/bin/bash
# Read-only: is the running simulator + Metro + app worth driving from THIS checkout?
# Prints one line per check and exits 1 when any check fails. Changes nothing.
# Usage: .claude/skills/verify-mobile/scripts/doctor.sh
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
bundle=com.example.skkumap
fail=0
ok()  { echo "ok   $*"; }
bad() { echo "FAIL $*"; fail=1; }

if udid=$("$here/sim-udid.sh" 2>/dev/null); then ok "simulator: booted iOS 26+ iPhone $udid"; else bad "simulator: no booted iOS 26+ iPhone"; fi

if [ -n "${udid:-}" ] && app=$(xcrun simctl get_app_container "$udid" "$bundle" 2>/dev/null); then
  base=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["extra"]["baseUrl"])' "$app/EXConstants.bundle/app.config" 2>/dev/null)
  ok "app: $bundle installed, embedded API host ${base:-unknown}"
else
  bad "app: $bundle is not installed on the simulator (build it, see Launch)"
fi

if [ "$(curl -s -m 3 http://127.0.0.1:8081/status)" = "packager-status:running" ]; then
  pid=$(lsof -nP -t -iTCP:8081 -sTCP:LISTEN 2>/dev/null | head -1)
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  if [ "$cwd" = "$repo/apps/mobile" ]; then ok "metro: pid $pid serves this checkout"
  else bad "metro: pid $pid on :8081 serves '$cwd', not $repo/apps/mobile (another checkout or session owns it; do not kill it)"; fi
else
  bad "metro: nothing answers on 127.0.0.1:8081 (start it, see Launch)"
fi

if (cd "$repo" && node scripts/check-patches.mjs >/dev/null 2>&1); then ok "patches: every patches/ file is applied"
else bad "patches: node_modules is missing a patch (run: node scripts/check-patches.mjs --fix)"; fi

targets=$(curl -s -m 3 http://127.0.0.1:8081/json/list 2>/dev/null | python3 -c 'import json,sys; print(sum("Bridgeless" in t.get("description","") for t in json.load(sys.stdin)))' 2>/dev/null)
if [ "${targets:-0}" -ge 1 ]; then ok "js: the app is connected to Metro ($targets debugger target)"
else bad "js: no app connected to Metro (launch the app, see Launch)"; fi

exit $fail
