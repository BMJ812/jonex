[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$IsoPath,

    [string]$VmName = 'JONEX-Atomic',

    [UInt64]$MemoryStartupBytes = 8GB,

    [UInt64]$VhdSizeBytes = 80GB,

    [int]$ProcessorCount = 4,

    [string]$SwitchName = 'Default Switch'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identity)

if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from an elevated PowerShell window.'
}

if (-not (Test-Path $IsoPath)) {
    throw "Fedora Kinoite ISO was not found: $IsoPath"
}

Import-Module Hyper-V -ErrorAction Stop

if (Get-VM -Name $VmName -ErrorAction SilentlyContinue) {
    throw "A Hyper-V VM named '$VmName' already exists."
}

$Switch = Get-VMSwitch -Name $SwitchName -ErrorAction SilentlyContinue

if (-not $Switch) {
    throw "Hyper-V virtual switch '$SwitchName' was not found."
}

$VmRoot = Join-Path $env:PUBLIC "Documents\Hyper-V\Virtual Hard Disks"
New-Item -ItemType Directory -Path $VmRoot -Force | Out-Null

$VhdPath = Join-Path $VmRoot "$VmName.vhdx"

New-VM `
    -Name $VmName `
    -Generation 2 `
    -MemoryStartupBytes $MemoryStartupBytes `
    -NewVHDPath $VhdPath `
    -NewVHDSizeBytes $VhdSizeBytes `
    -SwitchName $SwitchName | Out-Null

Set-VM `
    -Name $VmName `
    -AutomaticStartAction StartIfRunning `
    -AutomaticStopAction ShutDown `
    -CheckpointType ProductionOnly

Set-VMMemory `
    -VMName $VmName `
    -DynamicMemoryEnabled $false

Set-VMProcessor `
    -VMName $VmName `
    -Count $ProcessorCount

Set-VMFirmware `
    -VMName $VmName `
    -EnableSecureBoot On `
    -SecureBootTemplate 'MicrosoftUEFICertificateAuthority'

$Dvd = Add-VMDvdDrive `
    -VMName $VmName `
    -Path (Resolve-Path $IsoPath).Path `
    -Passthru

Set-VMFirmware `
    -VMName $VmName `
    -FirstBootDevice $Dvd

Start-VM -Name $VmName

Write-Host ''
Write-Host "JØNEX Fedora Atomic VM '$VmName' created and started." -ForegroundColor Green
Write-Host "CPU: $ProcessorCount" -ForegroundColor DarkGray
Write-Host "RAM: $([math]::Round($MemoryStartupBytes / 1GB, 1)) GB" -ForegroundColor DarkGray
Write-Host "Disk: $([math]::Round($VhdSizeBytes / 1GB, 1)) GB" -ForegroundColor DarkGray
Write-Host ''

Start-Process vmconnect.exe -ArgumentList 'localhost', $VmName