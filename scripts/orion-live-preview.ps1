param(
  [switch]$OpenChrome
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  return (Split-Path -Parent $PSScriptRoot)
}

function ConvertTo-SingleQuotedPsLiteral {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-RuntimeProfile {
  param([Parameter(Mandatory = $true)][string]$RepoRoot)

  $profileJson = & (Join-Path $RepoRoot 'scripts/orion-runtime-profile.ps1')
  return $profileJson | ConvertFrom-Json
}

function Get-EnvFileValue {
  param(
    [Parameter(Mandatory = $true)][string]$EnvFilePath,
    [Parameter(Mandatory = $true)][string]$Key
  )

  if (-not (Test-Path $EnvFilePath)) {
    return $null
  }

  foreach ($line in Get-Content -Path $EnvFilePath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $prefix = "$Key="
    if ($trimmed.StartsWith($prefix)) {
      return $trimmed.Substring($prefix.Length)
    }
  }

  return $null
}

function Get-ChromeExecutable {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $candidateList = @($candidates)
  if ($candidateList.Count -gt 0) {
    return $candidateList[0]
  }

  try {
    $command = Get-Command chrome.exe -ErrorAction Stop
    return $command.Source
  }
  catch {
    return $null
  }
}

function Get-ListeningConnection {
  param([Parameter(Mandatory = $true)][int]$Port)

  try {
    return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1
  }
  catch {
    return $null
  }
}

function Assert-PortFree {
  param(
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $connection = Get-ListeningConnection -Port $Port
  if ($null -ne $connection) {
    throw "$Label port $Port is already in use by PID $($connection.OwningProcess)."
  }
}

function Wait-ForUrl {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Label,
    [int]$MaxAttempts = 60,
    [int]$DelaySeconds = 1
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -UseBasicParsing
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return [pscustomobject]@{
          statusCode = $response.StatusCode
          attempt = $attempt
        }
      }
    }
    catch {
      Start-Sleep -Seconds $DelaySeconds
      continue
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  throw "$Label did not become ready at $Url."
}

function Start-BackgroundPwsh {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [Parameter(Mandatory = $true)][string]$CommandText,
    [Parameter(Mandatory = $true)][string]$StdoutPath,
    [Parameter(Mandatory = $true)][string]$StderrPath
  )

  $pwshExe = Join-Path $PSHOME 'pwsh.exe'
  if (-not (Test-Path $pwshExe)) {
    $pwshExe = 'pwsh'
  }

  return Start-Process `
    -FilePath $pwshExe `
    -WorkingDirectory $RepoRoot `
    -ArgumentList @('-NoProfile', '-Command', $CommandText) `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath `
    -PassThru
}

$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

$runtimeProfile = Get-RuntimeProfile -RepoRoot $repoRoot
$runtimeRoot = Join-Path $repoRoot '.orion/runtime'
$logsRoot = Join-Path $runtimeRoot 'logs'
$statePath = Join-Path $runtimeRoot 'live-preview-state.json'
$stopScriptPath = Join-Path $repoRoot 'scripts/orion-stop-live-preview.ps1'

New-Item -ItemType Directory -Force $runtimeRoot, $logsRoot | Out-Null

if (Test-Path $statePath) {
  & $stopScriptPath | Out-Null
}

Assert-PortFree -Port ([int]$runtimeProfile.apiPort) -Label 'API'
Assert-PortFree -Port ([int]$runtimeProfile.webPort) -Label 'Web preview'

$apiEntryPoint = Join-Path $repoRoot 'apps/api/dist/src/main.js'
$webBuildId = Join-Path $repoRoot 'apps/web/.next/BUILD_ID'
if (-not (Test-Path $apiEntryPoint)) {
  throw "API build output missing at $apiEntryPoint. Run the API build first."
}
if (-not (Test-Path $webBuildId)) {
  throw "Web build output missing at $webBuildId. Run the web build first."
}

$apiStdoutPath = Join-Path $logsRoot 'live-preview-api.stdout.log'
$apiStderrPath = Join-Path $logsRoot 'live-preview-api.stderr.log'
$webStdoutPath = Join-Path $logsRoot 'live-preview-web.stdout.log'
$webStderrPath = Join-Path $logsRoot 'live-preview-web.stderr.log'

$quotedRepoRoot = ConvertTo-SingleQuotedPsLiteral -Value $repoRoot
$quotedDbRelativePath = ConvertTo-SingleQuotedPsLiteral -Value ([string]$runtimeProfile.runtimeDbRelativePath)
$quotedApiPort = ConvertTo-SingleQuotedPsLiteral -Value ([string]$runtimeProfile.apiPort)
$quotedApiUpstream = ConvertTo-SingleQuotedPsLiteral -Value ([string]$runtimeProfile.apiUpstream)
$quotedWebPort = ConvertTo-SingleQuotedPsLiteral -Value ([string]$runtimeProfile.webPort)
$envFilePath = Join-Path $repoRoot '.env'
$jwtSecret = Get-EnvFileValue -EnvFilePath $envFilePath -Key 'ORION_JWT_SECRET'
if (-not $jwtSecret) {
  throw "ORION_JWT_SECRET was not found in $envFilePath."
}
$quotedJwtSecret = ConvertTo-SingleQuotedPsLiteral -Value $jwtSecret

$apiCommand = @"
Set-Location -LiteralPath $quotedRepoRoot
`$env:ORION_SQLITE_FILE = $quotedDbRelativePath
`$env:ORION_PORT = $quotedApiPort
`$env:ORION_JWT_SECRET = $quotedJwtSecret
corepack pnpm --filter @orion/api start:prod
"@

$webCommand = @"
Set-Location -LiteralPath $quotedRepoRoot
`$env:ORION_API_UPSTREAM = $quotedApiUpstream
corepack pnpm --filter @orion/web exec next start -H 127.0.0.1 -p $quotedWebPort
"@

$apiProcess = Start-BackgroundPwsh `
  -RepoRoot $repoRoot `
  -CommandText $apiCommand `
  -StdoutPath $apiStdoutPath `
  -StderrPath $apiStderrPath

try {
  $apiReady = Wait-ForUrl -Url "$($runtimeProfile.apiUpstream)/api/health" -Label 'API health'
}
catch {
  taskkill /PID $apiProcess.Id /T /F | Out-Null
  throw
}

$webProcess = Start-BackgroundPwsh `
  -RepoRoot $repoRoot `
  -CommandText $webCommand `
  -StdoutPath $webStdoutPath `
  -StderrPath $webStderrPath

try {
  $previewReady = Wait-ForUrl -Url ([string]$runtimeProfile.previewUrl) -Label 'Web preview'
}
catch {
  taskkill /PID $webProcess.Id /T /F | Out-Null
  taskkill /PID $apiProcess.Id /T /F | Out-Null
  throw
}

$chromePath = Get-ChromeExecutable
$chromeOpened = $false
$chromePid = $null
$chromeFailure = $null

if ($OpenChrome) {
  if (-not $chromePath) {
    $chromeFailure = 'Google Chrome executable was not found on this machine.'
  }
  else {
    try {
      $chromeProcess = Start-Process -FilePath $chromePath -ArgumentList @('--new-window', [string]$runtimeProfile.previewUrl) -PassThru
      $chromeOpened = $true
      $chromePid = $chromeProcess.Id
    }
    catch {
      $chromeFailure = $_.Exception.Message
    }
  }
}

$startedAt = (Get-Date).ToString('o')
$state = [ordered]@{
  previewUrl = [string]$runtimeProfile.previewUrl
  apiUrl = "$($runtimeProfile.apiUpstream)/api"
  apiHealthUrl = "$($runtimeProfile.apiUpstream)/api/health"
  runtimeProfile = [string]$runtimeProfile.profileName
  runtimeDbRelativePath = [string]$runtimeProfile.runtimeDbRelativePath
  runtimeDbAbsolutePath = [string]$runtimeProfile.runtimeDbAbsolutePath
  ports = [ordered]@{
    api = [int]$runtimeProfile.apiPort
    web = [int]$runtimeProfile.webPort
  }
  processIds = [ordered]@{
    api = $apiProcess.Id
    web = $webProcess.Id
    chrome = $chromePid
  }
  logs = [ordered]@{
    apiStdout = $apiStdoutPath
    apiStderr = $apiStderrPath
    webStdout = $webStdoutPath
    webStderr = $webStderrPath
  }
  readiness = [ordered]@{
    apiHealthStatus = $apiReady.statusCode
    apiReadyAttempt = $apiReady.attempt
    previewStatus = $previewReady.statusCode
    previewReadyAttempt = $previewReady.attempt
  }
  chrome = [ordered]@{
    requested = $OpenChrome.IsPresent
    executable = $chromePath
    opened = $chromeOpened
    failure = $chromeFailure
  }
  startedAt = $startedAt
}

($state | ConvertTo-Json -Depth 8) | Set-Content -Path $statePath -Encoding UTF8
Get-Content -Path $statePath -Raw
