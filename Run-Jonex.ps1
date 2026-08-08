$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

Write-Host ''
Write-Host 'JØNEX DEVELOPMENT LAUNCHER' -ForegroundColor Cyan
Write-Host "Repository: $ProjectRoot" -ForegroundColor DarkGray
Write-Host ''

$Node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$Npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
$Cargo = Get-Command 'cargo.exe' -ErrorAction SilentlyContinue

if (-not $Node) {
    throw 'node.exe was not found in PATH.'
}

if (-not $Npm) {
    throw 'npm.cmd was not found in PATH.'
}

if (-not $Cargo) {
    throw 'cargo.exe was not found in PATH.'
}

if (-not (Test-Path (Join-Path $ProjectRoot 'node_modules'))) {
    throw @"
JØNEX dependencies are not installed.

Run:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Bootstrap-Jonex.ps1
"@
}

Write-Host "Node  : $($Node.Source)" -ForegroundColor DarkGray
Write-Host "npm   : $($Npm.Source)" -ForegroundColor DarkGray
Write-Host "Cargo : $($Cargo.Source)" -ForegroundColor DarkGray
Write-Host ''

Write-Host 'Starting JØNEX native development shell...' -ForegroundColor Cyan
Write-Host 'Keep this terminal open while JØNEX is running.' -ForegroundColor DarkGray
Write-Host ''

& $Npm.Source run tauri:dev

$ExitCode = $LASTEXITCODE

if ($ExitCode -ne 0) {
    Write-Host ''
    Write-Host 'JØNEX exited with an error.' -ForegroundColor Red
    Write-Host "Exit code: $ExitCode" -ForegroundColor Red
    throw "JØNEX development launch failed with exit code $ExitCode."
}

Write-Host ''
Write-Host 'JØNEX development session ended normally.' -ForegroundColor Green