# ADR - Stage 8 Spine Freeze (Publication Summary)

## Status
Accepted

## Date
2026-03-24

## Context
Local accepted state includes:
- Stage 8.19 bounded Products closure (operator-truth reconciliation complete for already-active state).
- Stage 8.20 Inventory/Fiscal architecture freeze (implementation not started).

Run-pack artifacts for these stages are intentionally local-only under ignored `docs/_runs/run_*` paths.
GitHub publication must therefore carry tracked source/test/docs truth without force-adding ignored run folders or zip files.

## Decision
Freeze the architecture spine for subsequent implementation as follows:

1. ORION remains Jordan-first, compliance-first, ledger-first.
2. Tenant hierarchy is frozen to `Tenant -> LegalEntity -> Branch -> Register`.
3. Product identity is frozen to `Product -> ProductPack -> LotBatch`.
4. Fiscal lifecycle must be explicit for sale/return/credit note queue, accepted, rejected, retry, and cancel states.
5. Inventory must be batch/expiry/sellability-aware from day one.
6. Procurement traceability must include supplier master, PO, GRN, supplier invoice, supplier credit, supplier returns, and shortage/substitution events.
7. Tax handling must be item/pack category driven, not a flat invoice default.
8. MVP patient layer stays minimal and privacy-safe (no deep clinical history scope).
9. Bilingual EN/AR operator clarity and RTL correctness remain non-negotiable.

## Consequences
- Implementation order is constrained by the frozen hierarchy and lifecycle boundaries.
- No Inventory/Fiscal module expansion starts in this publication slice.
- Publication truth is represented by tracked docs and source/test changes; ignored run packs remain local evidence.

