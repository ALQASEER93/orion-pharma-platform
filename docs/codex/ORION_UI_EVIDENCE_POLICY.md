# ORION UI Evidence Policy

Any ORION user-visible change requires browser evidence before PASS.

## Required For Every UI Stage
- Explicit statement whether the slice included UI.
- Local preview command and preview URL.
- Browser Use plugin/in-app browser if available.
- Google Chrome if available.
- Browser walkthrough of the changed route or state.
- Screenshots stored under `docs/_runs/run_<timestamp>/screenshots/`.
- Screenshot inspection before verdict.
- Visible rejection/error state.
- Console/network errors if available.
- Final UX clarity verdict.
- Before/after notes when UI was modified.

## PASS/PARTIAL/FAIL
- PASS: preview runs, screenshots exist, rejection state is visible, UX clarity is acceptable, and tests relevant to the UI change pass.
- PARTIAL: UI evidence is mostly complete but a tool such as Chrome or Browser Use is unavailable and the limitation is documented.
- FAIL: UI changed without preview, browser walkthrough, screenshots, or rejection-state proof.

This governance pass did not touch app UI files, so browser UI evidence is not required for its own closeout.
