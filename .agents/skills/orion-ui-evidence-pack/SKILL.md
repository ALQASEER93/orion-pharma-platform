---
name: orion-ui-evidence-pack
description: Enforce review-grade UI evidence for ORION whenever any user-visible surface changes. Use when a stage touches UI and must prove reality with local preview, Google Chrome if available, browser walkthrough, screenshots, preview URL, a visible rejection path, UX clarity verdicts, and truthful screenshot labeling.
---

# ORION UI Evidence Pack

## Title
- Build review-grade UI evidence.

## When to use
- Use whenever an ORION slice changes any user-visible surface.
- Use when a reviewer needs browser-proof rather than code-only claims.
- Use when lock states, rejection states, or operator clarity must be proven visually.

## When NOT to use
- Do not use for backend-only slices.
- Do not use when only docs or workflow files changed.
- Do not use as a substitute for functional tests.

## Required inputs
- Local preview command or active preview URL.
- Target page/route.
- Exact UI states that must be evidenced.
- Whether Chrome is available.
- Known rejection path to demonstrate.
- Any operator clarity risks already suspected.

## Exact output contract
- State the preview URL.
- Open the relevant page in Google Chrome if available.
- Capture a browser walkthrough.
- Capture screenshots for:
  - empty/default state
  - in-progress interaction state
  - success state
  - rejection/error state
  - finalized/locked state if relevant
- Include an explicit UX clarity verdict.
- Explicitly note if controls are visually active but should be locked.
- Explicitly note if evidence labels do not match the actual screenshots.

## Failure conditions / stop conditions
- Stop if preview cannot run and the slice changed UI.
- Stop if screenshots are missing for required states.
- Stop if no visible rejection path is captured.
- Stop if evidence labels are misleading and have not been corrected.

## ORION-specific rules
- Prefer real backend wiring over mock-only UI.
- Keep operator clarity above visual polish.
- Treat confusing active-looking controls as an acceptance blocker when the state should be locked.
- Call out demo/auth context if shown, and reduce its visual dominance if it distracts operators.

## Backend-only example
- Not applicable for backend-only implementation.
- Output should explicitly state: `No new UI surface changed; UI evidence pack not required.`

## UI-slice example
- POS thin UI checkpoint:
  - Preview `http://127.0.0.1:3100/pos`
  - Show empty cart, cart with lines, finalize success, missing-selection error, and finalized lock state
  - Flag any enabled-looking mutate button in FINALIZED state as a clarity failure

## Anti-patterns / forbidden shortcuts
- Do not rely on backend rejection alone when controls should be visibly disabled.
- Do not label a screenshot as insufficient inventory if it actually shows missing selection.
- Do not claim Chrome evidence when Chrome was unavailable.
- Do not skip the preview URL in the final response.
