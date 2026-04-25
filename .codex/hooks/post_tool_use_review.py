#!/usr/bin/env python3
"""ORION post-tool review hook."""

import json
import sys

event = json.loads(sys.stdin.read() or "{}")
summary = str(event.get("output", ""))[:4000]
warnings = []
if "fatal:" in summary.lower() or "error:" in summary.lower():
    warnings.append("Tool output contains error text; record it in validation_log.md before claiming PASS.")
if "nothing to commit, working tree clean" in summary.lower():
    warnings.append("Clean git status observed; capture it in git_status_clean.txt for final evidence.")
print(json.dumps({"action": "allow", "warnings": warnings}))
