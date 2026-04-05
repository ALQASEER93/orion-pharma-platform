param()

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  return (Split-Path -Parent $PSScriptRoot)
}

function Stop-ProcessTree {
  param([Parameter(Mandatory = $true)][int]$ProcessId)

  try {
    $null = Get-Process -Id $ProcessId -ErrorAction Stop
  }
  catch {
    return $false
  }

  taskkill /PID $ProcessId /T /F | Out-Null
  return $true
}

$repoRoot = Get-RepoRoot
$statePath = Join-Path $repoRoot '.orion/runtime/live-preview-state.json'

if (-not (Test-Path $statePath)) {
  [pscustomobject]@{
    stopped = @()
    statePath = $statePath
    removedState = $false
    message = 'No live preview state file was present.'
  } | ConvertTo-Json -Depth 5
  exit 0
}

$state = Get-Content -Path $statePath -Raw | ConvertFrom-Json
$stopped = [System.Collections.Generic.List[string]]::new()

foreach ($entry in @(
    @{ name = 'web'; pid = $state.processIds.web },
    @{ name = 'api'; pid = $state.processIds.api }
  )) {
  $pidValue = 0
  if ($null -ne $entry.pid -and [int]::TryParse([string]$entry.pid, [ref]$pidValue) -and $pidValue -gt 0) {
    if (Stop-ProcessTree -ProcessId $pidValue) {
      $stopped.Add("$($entry.name):$pidValue") | Out-Null
    }
  }
}

Remove-Item -LiteralPath $statePath -Force

[pscustomobject]@{
  stopped = @($stopped)
  statePath = $statePath
  removedState = $true
  stoppedAt = (Get-Date).ToString('o')
} | ConvertTo-Json -Depth 5
