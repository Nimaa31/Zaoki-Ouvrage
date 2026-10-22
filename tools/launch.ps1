$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Host 'Node.js est requis pour lancer le serveur local. Installe Node.js, puis relance ce fichier.'
  Read-Host 'Entrée pour fermer'
  exit 1
}
$port = 4173
$existing = $false
foreach ($candidate in 4173..4183) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$candidate" -UseBasicParsing -TimeoutSec 1
    if ($response.Content -match 'js/manuscript.js') { $port = $candidate; $existing = $true; break }
  } catch { $port = $candidate; break }
}
if (-not $existing) {
  $env:PORT = [string]$port
  $serverFile = Join-Path $PSScriptRoot 'serve.cjs'
  Start-Process -FilePath $nodeCommand.Source -ArgumentList ('"{0}"' -f $serverFile) -WorkingDirectory $project -WindowStyle Hidden
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 100
    try { Invoke-WebRequest -Uri "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 1 | Out-Null; break } catch {}
  }
}
Start-Process "http://127.0.0.1:$port"
