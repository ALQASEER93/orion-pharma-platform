#!/usr/bin/env python3
"""ORION stop/continue final-claim guard."""

import json
import re
import sys

event = json.loads(sys.stdin.read() or "{}")
message = json.dumps(event)
warnings = []
if re.search(r"\bPASS\b|complete|done", message, re.IGNORECASE):
    for required in ["verification.json", ".zip", "LATEST.txt", "git_status_clean.txt"]:
        if required not in message:
            warnings.append(f"Final PASS-style claim should name {required}.")
print(json.dumps({"action": "allow", "warnings": warnings}))
