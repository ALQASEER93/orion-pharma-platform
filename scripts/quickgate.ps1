param()

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  Write-Host "==> $Name"
  & $Action
}

Invoke-Step -Name 'Install (frozen lockfile)' -Action {
  corepack pnpm -w install --frozen-lockfile
}

Invoke-Step -Name 'Lint' -Action {
  corepack pnpm -w lint
}

Invoke-Step -Name 'Typecheck' -Action {
  corepack pnpm -w typecheck
}

Invoke-Step -Name 'Unit tests' -Action {
  corepack pnpm -w test
}
