$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Set-Location $PSScriptRoot

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
    throw 'Dependencies are not installed. Run .\Bootstrap-Jonex.ps1 first.'
}

npm run dev
