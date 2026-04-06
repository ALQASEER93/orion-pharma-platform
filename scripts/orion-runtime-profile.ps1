$profileName = "stage834-local"
$repoRoot = Split-Path -Parent $PSScriptRoot
$dbRelativePath = ".orion/stage834_local.db"
$dbAbsolutePath = Join-Path $repoRoot $dbRelativePath
$apiPort = 3211
$webPort = 3120
$apiUpstream = "http://127.0.0.1:$apiPort"
$previewUrl = "http://127.0.0.1:$webPort/pos"

[pscustomobject]@{
  profileName = $profileName
  runtimeDbRelativePath = $dbRelativePath
  runtimeDbAbsolutePath = $dbAbsolutePath
  apiPort = $apiPort
  webPort = $webPort
  apiUpstream = $apiUpstream
  previewUrl = $previewUrl
  env = [pscustomobject]@{
    ORION_SQLITE_FILE = $dbRelativePath
    ORION_PORT = "$apiPort"
    ORION_API_UPSTREAM = $apiUpstream
  }
} | ConvertTo-Json -Depth 5
