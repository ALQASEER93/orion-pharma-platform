# Open Decisions

## Decision 1 - Negative Stock Policy (Required)
- Status: Open
- Context:
  - Current procurement/inventory services enforce non-negative behavior in key outbound flows.
  - Sales posting is not yet fully coupled to stock decrements in all paths.
- Options:
  - Option A: Strict non-negative stock for all operational postings.
  - Option B: Allow controlled negative stock with explicit permission and auto-reconciliation.
- Proposed Default:
  - Option A with narrowly scoped override permission (`inventory.override_negative`) and mandatory reason.
- Needed By:
  - Block 4 Slice 6 and Block 5 Slice 6.

## Decision 2 - Inventory Valuation Method (Required)
- Status: Open
- Context:
  - Block 5 requires deterministic COGS and inventory asset posting.
- Options:
  - Option A: Moving Average (simpler operationally, easier MVP rollout).
  - Option B: FIFO layers (more detailed but higher complexity).
  - Option C: Standard Cost (needs variance accounting design).
- Proposed Default:
  - Option A now; architecture compatible with future FIFO extension.
- Needed By:
  - Block 5 Slice 6.

## Decision 3 - Tax Strategy (Required)
- Status: Open
- Context:
  - Sales/procurement already carry tax fields at transaction level, but full accounting/tax engine policy is pending.
- Options:
  - Option A: Single tax profile per tenant with effective-dated rates.
  - Option B: Item/category + branch tax matrices.
  - Option C: External tax engine integration.
- Proposed Default:
  - Option A for MVP with effective dates and clear extension points.
- Needed By:
  - Block 4 Slice 5 and Block 5 Slices 2-4.

## Decision 4 - Branch Strategy (Required)
- Status: Open
- Context:
  - Branch exists in core entities, but branch-wide operational and accounting strategy is incomplete.
- Options:
  - Option A: Single-branch ledger with branch dimensions.
  - Option B: Multi-branch operational ledgers consolidated at tenant level.
  - Option C: Separate legal entities per branch (out of MVP scope).
- Proposed Default:
  - Option A for MVP; evolve to Option B when branch volume demands it.
- Needed By:
  - Block 4 Slice 4, Block 5 Slices 1-5, Block 6 filtering/segmentation.

## Additional Pending Decisions

### Decision 5 - Refund and Exchange Settlement Rules
- Status: Open
- Need: Block 4 Slice 3.
- Question: cash vs original method constraints and approval thresholds.

### Decision 6 - Posting Rule Versioning Strategy
- Status: Open
- Need: Block 5 Slice 3.
- Question: how to roll out rule changes with backward compatibility and period safety.

### Decision 7 - KPI Ownership and Sign-Off Workflow
- Status: Open
- Need: Block 6 Slice 1.
- Question: who approves KPI formulas before release and how revisions are governed.
