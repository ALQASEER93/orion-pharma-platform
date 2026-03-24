import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCodexPrompt,
  mergeReports,
  parseArgs,
  parseCsv,
} from '../../../scripts/run-orion-agents.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

test('orion task template keeps the required columns', () => {
  const templatePath = path.join(repoRoot, 'docs/_runs/templates/orion_tasks.csv');
  const rows = parseCsv(fs.readFileSync(templatePath, 'utf8'));

  assert.equal(rows.length >= 6, true);
  assert.deepEqual(Object.keys(rows[0]), ['agent', 'area', 'goal', 'outputs']);
});

test('autopilot prompt explicitly requests spawn_agents_on_csv', () => {
  const prompt = buildCodexPrompt({
    csvPath: 'docs/_runs/templates/orion_tasks.csv',
    outputCsvPath: 'docs/_runs/agent_results/results.csv',
  });

  assert.match(prompt, /spawn_agents_on_csv/);
  assert.match(prompt, /STRICT ISOLATION MODE/);
});

test('mergeReports builds a markdown summary for returned agent rows', () => {
  const markdown = mergeReports(
    [
      {
        agent: 'backend',
        area: 'api work',
        goal: 'Validate API tasks',
        status: 'completed',
        summary: 'No blockers',
        outputs: 'backend_changes.md',
        blockers: '[]',
        acceptance: 'all checks passed',
      },
    ],
    path.join(repoRoot, 'docs/_runs/agent_results/results.csv'),
  );

  assert.match(markdown, /# ORION Autopilot Report/);
  assert.match(markdown, /### backend/);
  assert.match(markdown, /Status: completed/);
});

test('parseArgs supports dry-run orchestration', () => {
  const options = parseArgs(['--csv', 'docs/_runs/templates/orion_tasks.csv', '--dry-run']);

  assert.equal(options.dryRun, true);
  assert.equal(
    options.csv.endsWith(path.join('docs', '_runs', 'templates', 'orion_tasks.csv')),
    true,
  );
});
