#!/usr/bin/env python3
"""Warn when accounting files change without invariant evidence."""

import json
import re
import sys

event = json.loads(sys.stdin.read() or "{}")
text = json.dumps(event)
accounting = re.search(r"ledger|journal|accounting|invoice|payment|fiscal|tax", text, re.IGNORECASE)
tested = re.search(r"test|invariant|balanced|debit|credit", text, re.IGNORECASE)
warnings = []
if accounting and not tested:
    warnings.append("ORION accounting/ledger changes require balancing invariant tests and run-pack evidence.")
print(json.dumps({"action": "allow", "warnings": warnings}))
