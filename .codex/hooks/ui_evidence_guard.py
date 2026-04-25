#!/usr/bin/env python3
"""Warn when UI files changed without evidence markers."""

import json
import re
import sys

event = json.loads(sys.stdin.read() or "{}")
text = json.dumps(event)
ui_changed = re.search(r"apps[/\\]web|\.tsx\b|\.css\b|\.scss\b", text, re.IGNORECASE)
has_evidence = re.search(r"screenshots|browser|preview url|ui evidence", text, re.IGNORECASE)
warnings = []
if ui_changed and not has_evidence:
    warnings.append("ORION UI changes require preview URL, Browser Use/Chrome walkthrough, screenshots, rejection state, and UX verdict.")
print(json.dumps({"action": "allow", "warnings": warnings}))
