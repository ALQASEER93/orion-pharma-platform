import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

describe('web smoke tests', () => {
  it('has app router page and manifest', () => {
    const pageContent = readFileSync('src/app/page.tsx', 'utf-8');
    const manifestContent = readFileSync('public/manifest.json', 'utf-8');

    assert.ok(pageContent.includes('Platform foundation initialized'));
    assert.ok(manifestContent.includes('ORION Pharma'));
  });
});
