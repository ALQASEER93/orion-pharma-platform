#!/usr/bin/env python3
"""ORION approval governance hook."""

import json
import re
import sys

event = json.loads(sys.stdin.read() or "{}")
text = json.dumps(event).lower()
deny = [
    r"danger-full-access",
    r"dangerously-bypass-approvals",
    r"git\s+reset\s+--hard",
    r"git\s+clean\s+-fd",
    r"git\s+push\b.*--force",
]
if any(re.search(pattern, text) for pattern in deny):
    print(json.dumps({"action": "block", "reason": "ORION approval policy denies destructive or Full Access defaults."}))
else:
    print(json.dumps({"action": "allow", "warnings": ["Document any elevated action in approval_governance_status.md."]}))
