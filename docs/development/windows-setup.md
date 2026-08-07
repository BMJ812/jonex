# Windows Development Setup

## Required software

- Git
- Node.js 22 or later
- Rust stable
- Microsoft Visual C++ Build Tools
- Microsoft Edge WebView2
- VS Code or another editor

## Build

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Dev\Jonex'
.\Bootstrap-Jonex.ps1
```

## Run native shell

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Dev\Jonex'
.\Run-Jonex.ps1
```

## Run browser mode

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Dev\Jonex'
.\Run-Jonex-Browser.ps1
```

Browser mode is for interface work and uses generated telemetry.
