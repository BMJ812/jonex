# Fedora Kinoite VM Target

## Baseline

- Fedora Kinoite 44
- x86_64
- Generation 2 UEFI VM
- 4 virtual CPUs
- 8 GB RAM
- 80 GB dynamically allocated virtual disk
- Secure Boot using the Microsoft UEFI Certificate Authority template
- Network access through the Hyper-V Default Switch

These values are the JØNEX development baseline, not minimum Fedora
requirements.

## Windows Hyper-V creation

Download and verify the Fedora Kinoite 44 x86_64 ISO before creating the VM.

Open an elevated PowerShell window and run:

```powershell
Set-Location 'C:\Dev\Jonex'

.\scripts\windows\New-JonexFedoraVm.ps1 `
    -IsoPath 'C:\path\to\Fedora-Kinoite-44-x86_64.iso'
```

The script creates `JONEX-Atomic`, attaches the ISO, configures UEFI Secure
Boot, starts the VM, and opens Hyper-V VMConnect.

## Installation policy

Install Fedora normally first. Do not enable JØNEX as a replacement desktop
session during OS installation.

After the first successful Fedora boot:

1. Apply Fedora updates.
2. Reboot.
3. Clone `BMJ812/jonex`.
4. Create the `jonex-dev` Toolbx.
5. Build the AppImage.
6. Launch JØNEX manually.
7. Validate telemetry and persistence.
8. Only then test graphical-session autostart.

## Recovery

Keep KDE Plasma available throughout Milestone 1.x. JØNEX must remain an
application layered on top of the normal Fedora session until dedicated-session
recovery has been validated.