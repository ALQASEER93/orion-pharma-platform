import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const productsPage = readFileSync('src/app/products/page.tsx', 'utf8');
const residualFallbackSource = readFileSync(
  'src/lib/products-residual-fallback.js',
  'utf8',
);

const approvedResidualFallbackKeys = [
  'Start with product names, strength, and pack so the workspace can judge readiness honestly.',
  'Core details are saved. Capture barcode before moving into catalog.',
  'Required details are complete. The draft can move into catalog as inactive.',
  'Move working draft into catalog when readiness is complete.',
  'Submit for approval if governance requires it, then promote when ready.',
  'Decide every changed field before approval or promotion.',
  'Record approval decision, then promote when approved.',
  'Promote when readiness and barcode checks pass.',
  'Review the execution plan below, then confirm the promotion before executing it.',
  'Activate when the product is truly launch-ready',
  'Keep active or return the draft to planning mode before editing',
];

describe('products message fallback boundary', () => {
  it('keeps the residual fallback map bounded to approved non-critical keys only', () => {
    const residualKeys = [...residualFallbackSource.matchAll(/^\s*"([^"]+)":/gm)].map(
      (match) => match[1],
    );

    assert.deepEqual(residualKeys, approvedResidualFallbackKeys);
  });

  it('routes contract-backed operational states through resolveContractMessage', () => {
    const expectedKeys = [
      'activationReady',
      'activationBlocked',
      'alreadyActive',
      'staleConflictRejection',
      'recoveryGuidance',
      'mergeSummary',
      'approvalSummary',
      'handoffSummary',
    ];

    for (const key of expectedKeys) {
      assert.match(
        productsPage,
        new RegExp(`resolveContractMessage\\([\\s\\S]*?"${key}"`),
      );
    }
  });

  it('routes activation continuity through activationSummary contract', () => {
    const activationSummaryKeys = [
      'currentState',
      'pendingState',
      'changedState',
      'nextStep',
    ];

    for (const key of activationSummaryKeys) {
      assert.match(
        productsPage,
        new RegExp(`resolveActivationContractMessage\\([\\s\\S]*?"${key}"`),
      );
    }
  });

  it('does not resolve contract-owned phrases through the residual fallback helper', () => {
    const removedPhrases = [
      'Loaded server-backed products workspace.',
      'No reference product is linked. Promotion will create or refresh catalog from this draft directly.',
      'No approval gate is required because there is no active reference merge delta.',
      'Promotion confirmation is persisted and the catalog product remains inactive until activation.',
      'Refresh the workspace after the blocked activation to recover to the latest server truth.',
    ];

    for (const phrase of removedPhrases) {
      assert.ok(!residualFallbackSource.includes(phrase), phrase);
    }
  });

  it('keeps the residual UI fallback map free of contract-owned activation phrases', () => {
    const removedPhrases = [
      'Activation is ready to be executed against the catalog-listed inactive product.',
      'The workspace rejected this action because the latest state changed before completion.',
      'Refresh the workspace, review the latest state, and retry only after clearing the blocker.',
      'Handoff package is ready. The next operator can continue without reading raw logs.',
      'Merge package is approved for promotion.',
      'Approval is blocked until all changed fields have explicit merge decisions.',
      'Catalog listed and still inactive. Activation is the next deliberate step.',
      'Catalog listed and active.',
      'Promotion is required before activation can run.',
      'No activation is pending until the draft is promoted into catalog.',
      'No activation is pending.',
      'Activation changes the catalog-listed product from inactive to active.',
    ];

    for (const phrase of removedPhrases) {
      assert.ok(!productsPage.includes(phrase), phrase);
    }
  });
});
