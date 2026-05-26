$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dataDir = Join-Path $root "data"
$backupDir = Join-Path $root "backups"
$db = Join-Path $dataDir "plankiller.db"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

if (-not (Test-Path $db)) {
  throw "Database not found: $db"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $backupDir "plankiller-$stamp.db"
Copy-Item -LiteralPath $db -Destination $target
Write-Output "Backup created: $target"
