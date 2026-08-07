$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Set-Location $PSScriptRoot

foreach ($Command in @(
    'git',
    'node',
    'npm.cmd',
    'cargo',
    'rustc'
)) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Required command '$Command' was not found in PATH."
    }
}

$Npm = (Get-Command 'npm.cmd' -ErrorAction Stop).Source

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Executable,

        [Parameter(Mandatory)]
        [string[]]$Arguments,

        [Parameter(Mandatory)]
        [string]$FailureMessage
    )

    & $Executable @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage Exit code: $LASTEXITCODE"
    }
}

Write-Host ''
Write-Host 'JØNEX FOUNDATION BOOTSTRAP' -ForegroundColor Cyan
Write-Host "Repository: $PSScriptRoot" -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path (Join-Path $PSScriptRoot '.git'))) {
    Write-Host 'Initializing Git repository...' -ForegroundColor Cyan

    Invoke-CheckedCommand `
        -Executable 'git' `
        -Arguments @(
            'init',
            '-b',
            'main'
        ) `
        -FailureMessage 'Git repository initialization failed.'
}

Write-Host 'Installing npm dependencies...' -ForegroundColor Cyan

Invoke-CheckedCommand `
    -Executable $Npm `
    -Arguments @(
        'install'
    ) `
    -FailureMessage 'npm dependency installation failed.'

$IconSource = Join-Path `
    $PSScriptRoot `
    'apps\shell\src-tauri\app-icon.svg'

$IconDirectory = Join-Path `
    $PSScriptRoot `
    'apps\shell\src-tauri\icons'

$RequiredIcons = @(
    (Join-Path $IconDirectory '32x32.png'),
    (Join-Path $IconDirectory '128x128.png'),
    (Join-Path $IconDirectory '128x128@2x.png'),
    (Join-Path $IconDirectory 'icon.ico')
)

$MissingIcons = @(
    $RequiredIcons |
        Where-Object {
            -not (Test-Path $_)
        }
)

if ($MissingIcons.Count -gt 0) {
    if (-not (Test-Path $IconSource)) {
        throw "Application icon source was not found: $IconSource"
    }

    Write-Host 'Generating Tauri application icons...' `
        -ForegroundColor Cyan

    Invoke-CheckedCommand `
        -Executable $Npm `
        -Arguments @(
            '--workspace',
            '@jonex/shell',
            'run',
            'tauri',
            '--',
            'icon',
            $IconSource
        ) `
        -FailureMessage 'Tauri icon generation failed.'

    Write-Host 'Cleaning the previous failed shell build...' `
        -ForegroundColor Cyan

    Invoke-CheckedCommand `
        -Executable 'cargo' `
        -Arguments @(
            'clean',
            '-p',
            'jonex-shell'
        ) `
        -FailureMessage 'Cargo package cleanup failed.'
}

foreach ($Icon in $RequiredIcons) {
    if (-not (Test-Path $Icon)) {
        throw "Required generated icon is missing: $Icon"
    }
}

Write-Host 'Formatting Rust workspace...' -ForegroundColor Cyan

Invoke-CheckedCommand `
    -Executable 'cargo' `
    -Arguments @(
        'fmt',
        '--all'
    ) `
    -FailureMessage 'Rust formatting failed.'

Write-Host 'Running TypeScript, tests, formatting, Clippy, and Rust checks...' `
    -ForegroundColor Cyan

Invoke-CheckedCommand `
    -Executable $Npm `
    -Arguments @(
        'run',
        'check'
    ) `
    -FailureMessage 'JØNEX validation failed.'

Write-Host 'Building frontend and Rust workspace...' `
    -ForegroundColor Cyan

Invoke-CheckedCommand `
    -Executable $Npm `
    -Arguments @(
        'run',
        'build'
    ) `
    -FailureMessage 'JØNEX workspace build failed.'

Write-Host ''
Write-Host 'JØNEX foundation validated successfully.' `
    -ForegroundColor Green
Write-Host 'Run .\Run-Jonex.ps1 to start the native shell.' `
    -ForegroundColor White
Write-Host ''

git status --short