#!/bin/bash
# List the labelled accessibility elements on screen, one per line: type, label, and the centre
# point to pass to `axe.sh tap`. Unlike XcodeBuildMCP snapshot_ui, this reaches bottom sheet
# bodies and works on the map screen.
# Usage: .claude/skills/verify-mobile/scripts/ui.sh            # everything labelled
#        .claude/skills/verify-mobile/scripts/ui.sh '닫기'     # lines whose label contains the text
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
"$here/axe.sh" describe-ui | python3 -c '
import json, sys
needle = sys.argv[1] if len(sys.argv) > 1 else ""
def walk(node):
    if isinstance(node, list):
        for child in node: walk(child)
        return
    label = node.get("AXLabel") or ""
    frame = node.get("frame") or {}
    if label and needle in label:
        x = frame.get("x", 0) + frame.get("width", 0) / 2
        y = frame.get("y", 0) + frame.get("height", 0) / 2
        kind = node.get("type", "")
        print(f"{kind:12} x={x:.0f} y={y:.0f}  {label}")
    walk(node.get("children") or [])
walk(json.load(sys.stdin))
' "${1:-}"
