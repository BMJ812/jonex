# Desktop IPC API

The desktop shell communicates with native Rust services through Tauri
commands. All contracts are pre-1.0.

## `get_system_snapshot`

Returns current host telemetry.

```json
{
  "sequence": 12,
  "sampledAtUnixMs": 1785700000000,
  "host": {
    "hostname": "jonex-node",
    "operatingSystem": "Fedora Linux",
    "kernelVersion": "6.x",
    "uptimeSeconds": 5400
  },
  "cpu": {
    "usagePercent": 18.4,
    "logicalCores": 16,
    "physicalCores": 8
  },
  "memory": {
    "totalBytes": 34359738368,
    "usedBytes": 12884901888,
    "availableBytes": 21474836480,
    "usagePercent": 37.5
  },
  "disks": []
}
```

## `list_plugins`

Discovers and validates plugin manifests.

```json
{
  "plugins": [
    {
      "manifest": {
        "schemaVersion": 1,
        "id": "jonex.system-overview",
        "name": "System Overview",
        "version": "0.1.0",
        "description": "Displays native host telemetry.",
        "publisher": "JØNEX Project",
        "entry": {
          "kind": "widget",
          "component": "system.telemetry"
        },
        "permissions": ["telemetry:read"],
        "capabilities": ["dashboard.widget"],
        "defaultEnabled": true
      },
      "sourcePath": "plugins/system-overview/manifest.json"
    }
  ],
  "diagnostics": []
}
```

## `get_platform_info`

Returns build and target metadata.

```json
{
  "appVersion": "0.1.0",
  "targetOs": "linux",
  "targetArch": "x86_64",
  "debugBuild": true
}
```

Commands that fail reject the invocation with a human-readable message.
Production errors must not expose secrets or unnecessary internal paths.
