[CmdletBinding()]
param(
  [string]$Timestamp = (Get-Date -Format 'yyyyMMdd_HHmmss')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runsRoot = Join-Path $repoRoot 'docs/_runs'
$runName = "run_$Timestamp"
$runDir = Join-Path $runsRoot $runName
$logsDir = Join-Path $runDir 'logs'
$artifactsDir = Join-Path $runDir 'artifacts'
$jsonDir = Join-Path $runDir 'json'
$zipPath = Join-Path $runsRoot "$runName.zip"
$latestPath = Join-Path $runsRoot 'LATEST.txt'
$reportPath = Join-Path $artifactsDir 'report.md'
$runStartedAt = Get-Date

$exitCodes = [ordered]@{}
$steps = [ordered]@{}
$checks = [ordered]@{}
$fatalError = $null

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -Path $Path -ItemType Directory -Force | Out-Null
  }
}

function Get-CommandOutput([string]$Command, [string[]]$CommandArgs = @()) {
  try {
    $out = & $Command @CommandArgs 2>$null | Out-String
    return $out.Trim()
  } catch {
    return 'unavailable'
  }
}

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @(),
    [bool]$Critical = $true
  )

  $logFile = Join-Path $logsDir "$Name.log"
  $started = Get-Date
  $commandText = "$Command $($Arguments -join ' ')".Trim()
  ">>> $commandText" | Tee-Object -FilePath $logFile -Append | Out-Null

  $code = 1
  try {
    & $Command @Arguments 2>&1 | Tee-Object -FilePath $logFile -Append
    if ($null -ne $LASTEXITCODE) {
      $code = [int]$LASTEXITCODE
    } else {
      $code = 0
    }
  } catch {
    $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null
    $code = 1
  }

  $duration = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
  $exitCodes[$Name] = $code
  $steps[$Name] = [ordered]@{
    exit_code = $code
    duration_seconds = $duration
    log = "logs/$Name.log"
    command = $commandText
  }

  if ($code -ne 0 -and $Critical) {
    throw "Critical step failed: $Name (exit code $code)"
  }

  return $code
}

function Wait-ForPostgresHealth {
  $logFile = Join-Path $logsDir 'postgres_health.log'
  $healthy = $false
  $lastValue = 'unknown'
  $attempts = 0

  for ($i = 1; $i -le 40; $i++) {
    $attempts = $i
    $value = (& docker inspect -f '{{.State.Health.Status}}' orion-postgres 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
      $value = 'unknown'
    }

    $lastValue = $value
    "check_$i=$value" | Tee-Object -FilePath $logFile -Append | Out-Null
    if ($value -eq 'healthy') {
      $healthy = $true
      break
    }
    Start-Sleep -Seconds 3
  }

  $checks.postgres_health = [ordered]@{
    expected = 'healthy'
    actual = $lastValue
    ok = $healthy
    attempts = $attempts
    log = 'logs/postgres_health.log'
  }

  $exitCodes['postgres_health'] = if ($healthy) { 0 } else { 1 }
  $steps['postgres_health'] = [ordered]@{
    exit_code = $exitCodes['postgres_health']
    duration_seconds = 0
    log = 'logs/postgres_health.log'
    command = 'docker inspect -f "{{.State.Health.Status}}" orion-postgres (retry loop)'
  }

  if (-not $healthy) {
    throw 'Postgres did not become healthy in time.'
  }
}

function Check-ApiHealth {
  $logFile = Join-Path $logsDir 'api_health.log'
  $ok = $false
  $lastPayload = $null
  $attempts = 0

  for ($i = 1; $i -le 30; $i++) {
    $attempts = $i
    try {
      $response = Invoke-RestMethod -Method Get -Uri 'http://localhost:3001/api/health' -TimeoutSec 5
      $lastPayload = $response
      $json = $response | ConvertTo-Json -Depth 5 -Compress
      "check_$i=$json" | Tee-Object -FilePath $logFile -Append | Out-Null
      if ($response.status -eq 'ok') {
        $ok = $true
        break
      }
    } catch {
      $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null
    }
    Start-Sleep -Seconds 2
  }

  if ($null -ne $lastPayload) {
    $lastPayload | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $artifactsDir 'api_health_response.json') -Encoding UTF8
  }

  $checks.api_health = [ordered]@{
    expected = 'status=ok'
    actual = if ($null -ne $lastPayload) { $lastPayload.status } else { 'no_response' }
    ok = $ok
    attempts = $attempts
    log = 'logs/api_health.log'
  }

  $exitCodes['api_health'] = if ($ok) { 0 } else { 1 }
  $steps['api_health'] = [ordered]@{
    exit_code = $exitCodes['api_health']
    duration_seconds = 0
    log = 'logs/api_health.log'
    command = 'GET http://localhost:3001/api/health (retry loop)'
  }

  if (-not $ok) {
    throw 'API health endpoint did not return status=ok in time.'
  }
}

function Write-RunJson {
  param([string]$OverallStatus)

  $status = [ordered]@{
    run_name = $runName
    run_dir = "docs/_runs/$runName"
    zip_path = "docs/_runs/$runName.zip"
    created_at = (Get-Date).ToString('o')
    overall = $OverallStatus
    checks = $checks
    steps = $steps
    fatal_error = $fatalError
  }

  $status | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $jsonDir 'status.json') -Encoding UTF8
  $exitCodes | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $jsonDir 'exit_codes.json') -Encoding UTF8
}

function Clean-WebCache {
  $webNext = Join-Path $repoRoot 'apps/web/.next'
  $logFile = Join-Path $logsDir 'clean_web_next.log'
  ">>> Remove-Item -Recurse -Force $webNext" | Tee-Object -FilePath $logFile -Append | Out-Null
  try {
    if (Test-Path $webNext) {
      Remove-Item -Recurse -Force $webNext
      "removed" | Tee-Object -FilePath $logFile -Append | Out-Null
    } else {
      "not_found" | Tee-Object -FilePath $logFile -Append | Out-Null
    }
    $exitCodes['clean_web_next'] = 0
  } catch {
    $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null
    $exitCodes['clean_web_next'] = 1
  }
  $steps['clean_web_next'] = [ordered]@{
    exit_code = $exitCodes['clean_web_next']
    duration_seconds = 0
    log = 'logs/clean_web_next.log'
    command = 'Remove apps/web/.next'
  }
}

function Get-Blockers {
  $items = @()
  foreach ($entry in $exitCodes.GetEnumerator()) {
    if ([int]$entry.Value -ne 0) {
      $items += "$($entry.Key): exit_code=$($entry.Value)"
    }
  }
  if ($fatalError) {
    $items += "fatal_error: $fatalError"
  }
  if ($items.Count -eq 0) {
    $items += 'None'
  }
  return $items
}

function Write-HumanReport {
  param([string]$OverallStatus)

  $branch = Get-CommandOutput git @('branch', '--show-current')
  $sha = Get-CommandOutput git @('rev-parse', 'HEAD')
  $nodeVersion = Get-CommandOutput node @('-v')
  $pnpmVersion = Get-CommandOutput corepack @('pnpm', '-v')
  $prismaVersion = Get-CommandOutput corepack @('pnpm', '--filter', '@orion/api', 'exec', 'prisma', '--version')
  $hostname = $env:COMPUTERNAME
  $os = Get-CommandOutput pwsh @('-NoProfile', '-Command', '$PSVersionTable.OS')

  $prUrl = ''
  if ($env:GITHUB_SERVER_URL -and $env:GITHUB_REPOSITORY -and $env:GITHUB_REF -match 'refs/pull/([0-9]+)/') {
    $prUrl = "$($env:GITHUB_SERVER_URL)/$($env:GITHUB_REPOSITORY)/pull/$($matches[1])"
  }

  $actionsUrl = ''
  if ($env:GITHUB_SERVER_URL -and $env:GITHUB_REPOSITORY -and $env:GITHUB_RUN_ID) {
    $actionsUrl = "$($env:GITHUB_SERVER_URL)/$($env:GITHUB_REPOSITORY)/actions/runs/$($env:GITHUB_RUN_ID)"
  }
  $prUrlDisplay = if ([string]::IsNullOrWhiteSpace($prUrl)) { 'n/a' } else { $prUrl }
  $actionsUrlDisplay = if ([string]::IsNullOrWhiteSpace($actionsUrl)) { 'n/a' } else { $actionsUrl }

  $migrationsPath = Join-Path $repoRoot 'apps/api/prisma/migrations'
  $migrations = @()
  if (Test-Path $migrationsPath) {
    $migrations = Get-ChildItem $migrationsPath -Directory | Sort-Object Name
  }
  $latestMigration = if ($migrations.Count -gt 0) { $migrations[-1].Name } else { 'none' }
  $blockers = Get-Blockers
  $postgresCheck = if ($checks.Contains('postgres_health')) { $checks['postgres_health'] } else { [ordered]@{ actual = 'n/a'; attempts = 'n/a' } }
  $apiCheck = if ($checks.Contains('api_health')) { $checks['api_health'] } else { [ordered]@{ actual = 'n/a'; attempts = 'n/a' } }

  function Get-StepCode([string]$Key) {
    if ($exitCodes.Contains($Key)) {
      return $exitCodes[$Key]
    }
    return 'n/a'
  }

  $lines = @(
    '# RunPack Report',
    '',
    '## Project',
    '- ORION PHARMA',
    '',
    '## Run Metadata',
    "- Run timestamp: $($runStartedAt.ToString('o'))",
    "- Run name: $runName",
    "- Machine: $hostname",
    "- OS: $os",
    "- Node: $nodeVersion",
    "- pnpm: $pnpmVersion",
    '- Prisma:',
    '```text',
    $prismaVersion,
    '```',
    '',
    '## Git',
    "- Branch: $branch",
    "- Commit SHA: $sha",
    '',
    '## Docker Validation',
    "- compose_down exit: $(Get-StepCode 'compose_down')",
    "- compose_build exit: $(Get-StepCode 'compose_build')",
    "- compose_up exit: $(Get-StepCode 'compose_up')",
    "- compose_ps exit: $(Get-StepCode 'compose_ps')",
    "- postgres health: $($postgresCheck.actual) (attempts: $($postgresCheck.attempts))",
    "- api health: $($apiCheck.actual) (attempts: $($apiCheck.attempts))",
    '',
    '## Prisma',
    "- prisma:deploy exit: $(Get-StepCode 'prisma_migrate')",
    "- seed exit: $(Get-StepCode 'prisma_seed')",
    "- migrations directory: apps/api/prisma/migrations (count: $($migrations.Count), latest: $latestMigration)",
    '',
    '## Quality Gates',
    "- lint: $(Get-StepCode 'lint')",
    "- typecheck: $(Get-StepCode 'typecheck')",
    "- test: $(Get-StepCode 'test')",
    "- build: $(Get-StepCode 'build')",
    '',
    '## Links',
    "- PR URL: $prUrlDisplay",
    "- Actions run URL: $actionsUrlDisplay",
    '',
    '## Result',
    "- overall: $OverallStatus",
    '',
    '## Top Blockers'
  )

  foreach ($item in $blockers) {
    $lines += "- $item"
  }

  $lines | Set-Content -Path $reportPath -Encoding UTF8
}

Ensure-Directory $runsRoot
Ensure-Directory $runDir
Ensure-Directory $logsDir
Ensure-Directory $artifactsDir
Ensure-Directory $jsonDir

Set-Location $repoRoot

try {
  Invoke-LoggedCommand -Name 'docker_context' -Command 'docker' -Arguments @('context', 'use', 'desktop-linux') | Out-Null
  Invoke-LoggedCommand -Name 'compose_down' -Command 'docker' -Arguments @('compose', 'down', '-v') | Out-Null
  Invoke-LoggedCommand -Name 'compose_build' -Command 'docker' -Arguments @('compose', 'build') | Out-Null
  Invoke-LoggedCommand -Name 'compose_up' -Command 'docker' -Arguments @('compose', 'up', '-d') | Out-Null
  Invoke-LoggedCommand -Name 'compose_ps' -Command 'docker' -Arguments @('compose', 'ps') | Out-Null
  Invoke-LoggedCommand -Name 'compose_ps_json' -Command 'docker' -Arguments @('compose', 'ps', '--format', 'json') -Critical $false | Out-Null

  if (Test-Path (Join-Path $logsDir 'compose_ps_json.log')) {
    Copy-Item (Join-Path $logsDir 'compose_ps_json.log') (Join-Path $artifactsDir 'compose_ps.json') -Force
  }

  Wait-ForPostgresHealth
  Check-ApiHealth

  Invoke-LoggedCommand -Name 'prisma_migrate' -Command 'corepack' -Arguments @('pnpm', '--filter', '@orion/api', 'prisma:deploy') | Out-Null
  Invoke-LoggedCommand -Name 'prisma_seed' -Command 'corepack' -Arguments @('pnpm', '--filter', '@orion/api', 'prisma', 'db', 'seed') | Out-Null
  Clean-WebCache
  Invoke-LoggedCommand -Name 'lint' -Command 'corepack' -Arguments @('pnpm', 'lint') | Out-Null
  Invoke-LoggedCommand -Name 'typecheck' -Command 'corepack' -Arguments @('pnpm', 'typecheck') | Out-Null
  Invoke-LoggedCommand -Name 'test' -Command 'corepack' -Arguments @('pnpm', 'test') | Out-Null
  Invoke-LoggedCommand -Name 'build' -Command 'corepack' -Arguments @('pnpm', 'build') | Out-Null
} catch {
  $fatalError = $_.Exception.Message
}

$failed = $false
foreach ($entry in $exitCodes.GetEnumerator()) {
  if ([int]$entry.Value -ne 0) {
    $failed = $true
    break
  }
}

$overallStatus = if ($failed -or $null -ne $fatalError) { 'failed' } else { 'passed' }
Write-RunJson -OverallStatus $overallStatus
Write-HumanReport -OverallStatus $overallStatus

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $runDir '*') -DestinationPath $zipPath -Force
$runName | Set-Content -Path $latestPath -Encoding UTF8

if ($overallStatus -eq 'failed') { exit 1 }
exit 0
