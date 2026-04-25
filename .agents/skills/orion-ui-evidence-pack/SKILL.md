---
name: orion-ui-evidence-pack
description: Require local preview, Browser Use or Chrome walkthrough, screenshots, rejection state, console/network notes, and UX verdict for any ORION UI change.
---

# ORION UI Evidence Pack

## Trigger Conditions
- Any changed user-visible ORION surface.
- Any route, component, text, layout, form, POS, admin, pharmacy, accounting, or responsive behavior change.
- Any reviewer request for browser proof.

## Non-Goals
- Do not use for docs-only, hooks-only, or backend-only slices.
- Do not replace tests or API validation.
- Do not edit code unless explicitly assigned.

## ORION Constraints
- Browser Use plugin is preferred when available.
- Google Chrome should be used if available.
- Arabic and English pharmacy/admin/accounting terminology must be checked when visible.
- No UI PASS without visible rejection/error-state proof.

## Required Outputs
- Preview command and URL.
- Browser walkthrough notes.
- Screenshots path.
- Console/network error notes when available.
- Rejection/error state evidence.
- Final UX clarity verdict and before/after notes when UI changed.

## PASS/PARTIAL/FAIL Rules
- PASS: preview ran, browser was inspected, screenshots exist, rejection state is visible, and UX clarity is acceptable.
- PARTIAL: browser or Chrome unavailable but limitation is documented and alternative evidence exists.
- FAIL: UI changed without runnable preview, screenshots, or rejection-state proof.

## Evidence Requirements
- `docs/_runs/run_<timestamp>/screenshots/` when UI is touched.
- Screenshot labels must match actual content.
- Note whether the slice included UI.

## Examples
- Use for POS checkout visual changes.
- Use for admin dashboard form-state changes.
- Do not use for this Codex governance pass unless app UI files are touched.
