#!/usr/bin/env python3
"""Validate ORION run-pack path references in final evidence."""

import json
import re
import sys

event = json.loads(sys.stdin.read() or "{}")
text = json.dumps(event)
warnings = []
if "docs/_runs" in text and not re.search(r"docs[/\\]_runs[/\\]run_\d{8}_\d{6}", text):
    warnings.append("Run evidence should use docs/_runs/run_<timestamp>/ paths.")
if "PASS" in text and "verification.json" not in text:
    warnings.append("PASS requires verification.json evidence.")
print(json.dumps({"action": "allow", "warnings": warnings}))
