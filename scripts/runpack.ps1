param(
  [switch]$UseDocker
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  $current = Get-Location
  while ($true) {
    if (Test-Path (Join-Path $current 'pnpm-workspace.yaml')) {
      return $current.Path
    }

    $parent = Split-Path -Parent $current
    if ($parent -eq $current.Path -or [string]::IsNullOrWhiteSpace($parent)) {
      return (Get-Location).Path
    }

    $current = Get-Item $parent
  }
}

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @(),
    [switch]$Critical
  )

  $logPath = Join-Path $logsDir "$Name.log"
  $started = Get-Date
  "`$ $Command $($Arguments -join ' ')" | Set-Content -Path $logPath -Encoding UTF8

  try {
    & $Command @Arguments *>> $logPath
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }
  }
  catch {
    $_ | Out-String | Add-Content -Path $logPath -Encoding UTF8
    $exitCode = 1
  }

  $duration = [Math]::Round(((Get-Date) - $started).TotalSeconds, 2)
  $exitCodes[$Name] = $exitCode
  $steps[$Name] = [ordered]@{
    exit_code = $exitCode
    duration_seconds = $duration
    log = "logs/$Name.log"
    command = "$Command $($Arguments -join ' ')".Trim()
  }

  if ($exitCode -ne 0) {
    $blockers.Add("${Name}: exit_code=$exitCode") | Out-Null
    if ($Critical) {
      throw "Critical step failed: $Name (exit code $exitCode)"
    }
  }

  return $exitCode
}

function Write-StatusJson {
  param([string]$Overall, [string]$FatalError)

  $status = [ordered]@{
    run_name = $runName
    run_dir = "docs/_runs/$runName"
    zip_path = "docs/_runs/$runName.zip"
    created_at = (Get-Date).ToString('o')
    overall_pass = ($Overall -eq 'passed')
    overall = $Overall
    fatal_error = $FatalError
    blockers = @($blockers)
    branch = $branch
    commit = $commit
    checks = $checks
    steps = $steps
  }

  ($status | ConvertTo-Json -Depth 8) | Set-Content -Path (Join-Path $jsonDir 'status.json') -Encoding UTF8
  ($exitCodes | ConvertTo-Json -Depth 4) | Set-Content -Path (Join-Path $jsonDir 'exit_codes.json') -Encoding UTF8
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$runName = "run_$timestamp"
$runDir = Join-Path $repoRoot "docs/_runs/$runName"
$logsDir = Join-Path $runDir 'logs'
$artifactsDir = Join-Path $runDir 'artifacts'
$jsonDir = Join-Path $runDir 'json'

New-Item -ItemType Directory -Force $logsDir, $artifactsDir, $jsonDir | Out-Null

$exitCodes = [ordered]@{}
$steps = [ordered]@{}
$checks = [ordered]@{}
$blockers = [System.Collections.Generic.List[string]]::new()
$fatalError = ''

$branch = (& git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim()
$commit = (& git rev-parse HEAD 2>$null | Out-String).Trim()
$nodeVersion = (& node --version 2>$null | Out-String).Trim()
$pnpmVersion = (& corepack pnpm --version 2>$null | Out-String).Trim()
$prismaVersion = (& corepack pnpm --filter @orion/api exec prisma --version 2>$null | Out-String).Trim()

$dockerEnabled = $UseDocker.IsPresent -or ($env:ORION_RUNPACK_USE_DOCKER -eq '1')

try {
  if ($dockerEnabled) {
    Invoke-LoggedCommand -Name 'docker_context' -Command 'docker' -Arguments @('context', 'use', 'desktop-linux') -Critical | Out-Null
    Invoke-LoggedCommand -Name 'compose_down' -Command 'docker' -Arguments @('compose', 'down', '-v') -Critical | Out-Null
    Invoke-LoggedCommand -Name 'compose_build' -Command 'docker' -Arguments @('compose', 'build') -Critical | Out-Null
    Invoke-LoggedCommand -Name 'compose_up' -Command 'docker' -Arguments @('compose', 'up', '-d') -Critical | Out-Null
    Invoke-LoggedCommand -Name 'compose_ps' -Command 'docker' -Arguments @('compose', 'ps') | Out-Null
  }
  else {
    $steps['docker_mode'] = [ordered]@{
      exit_code = 0
      duration_seconds = 0
      log = 'logs/docker_mode.log'
      command = 'docker skipped (ORION_RUNPACK_USE_DOCKER != 1)'
    }
    $exitCodes['docker_mode'] = 0
    'Docker checks skipped by default (dockerless mode).' | Set-Content -Path (Join-Path $logsDir 'docker_mode.log') -Encoding UTF8
  }

  Invoke-LoggedCommand -Name 'prisma_generate' -Command 'corepack' -Arguments @('pnpm', '--filter', '@orion/api', 'prisma:generate') -Critical | Out-Null
  Invoke-LoggedCommand -Name 'prisma_deploy' -Command 'corepack' -Arguments @('pnpm', '--filter', '@orion/api', 'prisma:deploy') -Critical | Out-Null
  Invoke-LoggedCommand -Name 'prisma_seed' -Command 'corepack' -Arguments @('pnpm', '--filter', '@orion/api', 'prisma', 'db', 'seed') -Critical | Out-Null

  Invoke-LoggedCommand -Name 'lint' -Command 'corepack' -Arguments @('pnpm', 'lint') -Critical | Out-Null
  Invoke-LoggedCommand -Name 'typecheck' -Command 'corepack' -Arguments @('pnpm', 'typecheck') -Critical | Out-Null
  Invoke-LoggedCommand -Name 'test' -Command 'corepack' -Arguments @('pnpm', 'test') -Critical | Out-Null
  Invoke-LoggedCommand -Name 'api_health_e2e' -Command 'corepack' -Arguments @('pnpm', '--filter', '@orion/api', 'exec', 'jest', '--config', './test/jest-e2e.json', '--runInBand', 'app.e2e-spec.ts') -Critical | Out-Null
  Invoke-LoggedCommand -Name 'build' -Command 'corepack' -Arguments @('pnpm', 'build') -Critical | Out-Null
}
catch {
  $fatalError = $_.Exception.Message
  $blockers.Add("fatal_error: $fatalError") | Out-Null
}

$overall = if ($blockers.Count -eq 0) { 'passed' } else { 'failed' }

$checks['prisma_deploy'] = [ordered]@{ exit_code = $exitCodes['prisma_deploy'] }
$checks['prisma_seed'] = [ordered]@{ exit_code = $exitCodes['prisma_seed'] }
$checks['lint'] = [ordered]@{ exit_code = $exitCodes['lint'] }
$checks['typecheck'] = [ordered]@{ exit_code = $exitCodes['typecheck'] }
$checks['test'] = [ordered]@{ exit_code = $exitCodes['test'] }
$checks['api_health_e2e'] = [ordered]@{ exit_code = $exitCodes['api_health_e2e'] }
$checks['build'] = [ordered]@{ exit_code = $exitCodes['build'] }

Write-StatusJson -Overall $overall -FatalError $fatalError

$reportPath = Join-Path $artifactsDir 'report.md'
$reportLines = @(
  '# RunPack Report',
  '',
  '## Project',
  '- ORION PHARMA',
  '',
  '## Run Metadata',
  "- Run timestamp: $((Get-Date).ToString('o'))",
  "- Run name: $runName",
  "- Branch: $branch",
  "- Commit: $commit",
  "- Node: $nodeVersion",
  "- pnpm: $pnpmVersion",
  '',
  '## Prisma',
  "- Provider: $($env:ORION_DB_PROVIDER ?? 'sqlite')",
  "- ORION_DATABASE_URL: $($env:ORION_DATABASE_URL ?? '(auto sqlite in .orion/dev.db)')",
  "- prisma:generate exit: $($exitCodes['prisma_generate'])",
  "- prisma:deploy exit: $($exitCodes['prisma_deploy'])",
  "- prisma seed exit: $($exitCodes['prisma_seed'])",
  '',
  '## Validation',
  "- lint exit: $($exitCodes['lint'])",
  "- typecheck exit: $($exitCodes['typecheck'])",
  "- test exit: $($exitCodes['test'])",
  "- api health e2e exit: $($exitCodes['api_health_e2e'])",
  "- build exit: $($exitCodes['build'])",
  '',
  '## Docker',
  "- mode: $(if ($dockerEnabled) { 'enabled (optional)' } else { 'skipped (dockerless default)' })",
  '',
  '## How To Run Without Docker',
  '1. Configure `.env` from `.env.example` (keep `ORION_DB_PROVIDER=sqlite`).',
  '2. Run `corepack pnpm install`.',
  '3. Run `corepack pnpm --filter @orion/api prisma:deploy` then `corepack pnpm --filter @orion/api prisma db seed`.',
  '4. Start API: `corepack pnpm --filter @orion/api start:dev`.',
  '5. Start Web: `corepack pnpm --filter @orion/web dev`.',
  '',
  '## Risks / Follow-ups',
  '- PostgreSQL remains optional via `ORION_DB_PROVIDER=postgresql` and `ORION_DATABASE_URL` override.',
  '- If running with Postgres, use the Postgres Prisma schema path through `prisma-env` helper.',
  '',
  '## Result',
  "- overall: $overall",
  '- blockers:'
)

if ($blockers.Count -eq 0) {
  $reportLines += '- none'
}
else {
  foreach ($b in $blockers) { $reportLines += "- $b" }
}

$reportLines | Set-Content -Path $reportPath -Encoding UTF8

$zipPath = Join-Path $repoRoot "docs/_runs/$runName.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path $runDir -DestinationPath $zipPath -Force
Set-Content -Path (Join-Path $repoRoot 'docs/_runs/LATEST.txt') -Value $runName -Encoding UTF8

if ($overall -eq 'passed') {
  exit 0
}

exit 1
