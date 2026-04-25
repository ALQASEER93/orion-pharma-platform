#!/usr/bin/env python3
"""ORION pre-tool policy guard.

Reads a JSON tool event from stdin when Codex hooks provide one. It prints a
JSON decision. Hooks are guardrails, not a security boundary.
"""

import json
import re
import sys

event = json.loads(sys.stdin.read() or "{}")
text = " ".join(str(v) for v in event.values() if isinstance(v, (str, int, float)))
lower = text.lower()

block_patterns = [
    r"git\s+reset\s+--hard",
    r"git\s+clean\s+-fd",
    r"\brm\s+-rf\b",
    r"\bdel\s+/s\s+/q\b",
    r"remove-item\b.*-recurse\b.*-force\b",
    r"git\s+push\b.*--force",
    r"git\s+push\b.*\bmain\b",
    r"docs[/\\]_runs.*remove-item",
    r"docs[/\\]_runs.*\brm\s+-rf\b",
]
warn_patterns = [
    r"git\s+push\b",
    r"gh\s+pr\b",
    r"package-lock\.json|pnpm-lock\.yaml|yarn\.lock",
    r"prisma[/\\]migrations",
]

decision = {"action": "allow", "warnings": []}
if any(re.search(pattern, lower) for pattern in block_patterns):
    decision = {"action": "block", "reason": "ORION blocks destructive or main-branch commands without explicit approval."}
elif any(re.search(pattern, lower) for pattern in warn_patterns):
    decision["warnings"].append("Verify local run-pack evidence before GitHub, lockfile, or migration side effects.")

print(json.dumps(decision))
