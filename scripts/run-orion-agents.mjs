import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_TEMPLATE = path.resolve('docs/_runs/templates/orion_tasks.csv');
const DEFAULT_OUTPUT_DIR = path.resolve('docs/_runs/agent_results');

export function parseArgs(argv) {
  const options = {
    csv: DEFAULT_TEMPLATE,
    outputDir: DEFAULT_OUTPUT_DIR,
    model: process.env.ORION_AUTOPILOT_MODEL ?? 'gpt-5.3-codex',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--csv') {
      options.csv = path.resolve(argv[++index]);
    } else if (arg === '--output-dir') {
      options.outputDir = path.resolve(argv[++index]);
    } else if (arg === '--model') {
      options.model = argv[++index];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function parseCsv(content) {
  const rows = content
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => splitCsvLine(line));

  if (rows.length < 2) {
    throw new Error('Task CSV must include a header and at least one task row.');
  }

  const [header, ...dataRows] = rows;
  const required = ['agent', 'area', 'goal', 'outputs'];
  for (const field of required) {
    if (!header.includes(field)) {
      throw new Error(`Task CSV is missing required column "${field}".`);
    }
  }

  return dataRows.map((values) => Object.fromEntries(header.map((key, idx) => [key, values[idx] ?? ''])));
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

export function buildCodexPrompt({ csvPath, outputCsvPath }) {
  return [
    'PROJECT: ORION PHARMA — STRICT ISOLATION MODE.',
    `Use spawn_agents_on_csv with csv_path="${csvPath}" and output_csv_path="${outputCsvPath}".`,
    'Each row already defines agent, area, goal, and outputs.',
    'Return structured JSON per row with these keys:',
    '- agent',
    '- area',
    '- status',
    '- summary',
    '- outputs',
    '- blockers',
    '- acceptance',
    'Do not refactor application code unless the row explicitly requests it.',
  ].join('\n');
}

export function mergeReports(rows, resultsCsvPath) {
  const lines = [
    '# ORION Autopilot Report',
    '',
    `- Task source: \`${path.relative(process.cwd(), resultsCsvPath)}\``,
    `- Generated at: \`${new Date().toISOString()}\``,
    '',
    '## Agent Results',
  ];

  for (const row of rows) {
    lines.push(`### ${row.agent}`);
    lines.push(`- Area: ${row.area || '(missing)'}`);
    lines.push(`- Status: ${row.status || 'unknown'}`);
    lines.push(`- Goal: ${row.goal || '(missing)'}`);
    lines.push(`- Summary: ${row.summary || '(missing)'}`);
    lines.push(`- Outputs: ${row.outputs || '(missing)'}`);
    lines.push(`- Blockers: ${row.blockers || '[]'}`);
    lines.push(`- Acceptance: ${row.acceptance || '(missing)'}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const csvText = fs.readFileSync(options.csv, 'utf8');
  const tasks = parseCsv(csvText);

  fs.mkdirSync(options.outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const outputCsvPath = path.join(options.outputDir, `orion_autopilot_results_${timestamp}.csv`);
  const reportPath = path.join(options.outputDir, `orion_autopilot_report_${timestamp}.md`);
  const prompt = buildCodexPrompt({ csvPath: options.csv, outputCsvPath });

  if (options.dryRun) {
    console.log(JSON.stringify({ csv: options.csv, outputCsvPath, reportPath, prompt }, null, 2));
    return;
  }

  const result = spawnSync(
    'codex',
    ['exec', '--full-auto', '--enable', 'multi_agent', '--model', options.model, prompt],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!fs.existsSync(outputCsvPath)) {
    throw new Error(`Codex run completed but results CSV was not created: ${outputCsvPath}`);
  }

  const mergedRows = parseCsv(fs.readFileSync(outputCsvPath, 'utf8')).map((row, index) => ({
    agent: row.agent || tasks[index]?.agent || `agent-${index + 1}`,
    area: row.area || tasks[index]?.area || '',
    goal: row.goal || tasks[index]?.goal || '',
    status: row.status || '',
    summary: row.summary || '',
    outputs: row.outputs || tasks[index]?.outputs || '',
    blockers: row.blockers || '',
    acceptance: row.acceptance || '',
  }));

  fs.writeFileSync(reportPath, mergeReports(mergedRows, outputCsvPath), 'utf8');
  console.log(`Results CSV: ${path.relative(process.cwd(), outputCsvPath)}`);
  console.log(`Merged report: ${path.relative(process.cwd(), reportPath)}`);
}

if (import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main();
}
