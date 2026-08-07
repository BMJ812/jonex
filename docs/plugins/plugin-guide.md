# JØNEX Plugin Guide

## Current plugin level

JØNEX currently supports declarative, filesystem-discovered widget plugins.

The native host validates manifests. The shell renders only component
identifiers present in its trusted component registry. Discovery is not
arbitrary code execution.

## Layout

```text
plugins/
  example-plugin/
    manifest.json
```

## Manifest

```json
{
  "schemaVersion": 1,
  "id": "example.status-widget",
  "name": "Example Status Widget",
  "version": "0.1.0",
  "description": "Displays example operational status.",
  "publisher": "Example Publisher",
  "entry": {
    "kind": "widget",
    "component": "example.status"
  },
  "permissions": [],
  "capabilities": ["dashboard.widget"],
  "defaultEnabled": true
}
```

## Identifier rules

Plugin identifiers:

- Begin with a lowercase ASCII letter or number
- Contain lowercase letters, numbers, periods, and hyphens
- Are unique across discovered roots

## Entry kinds

- `widget`
- `integration`
- `service`

Only widgets are currently rendered.

## Reserved permission namespaces

```text
telemetry:read
notifications:write
containers:read
containers:control
home-assistant:read
home-assistant:control
filesystem:read
network:connect
process:execute
secrets:read
```

Declaring a permission does not automatically grant it.

## Discovery roots

The desktop scans:

1. Repository `plugins` directory
2. JØNEX application-data plugin directory
3. Directory specified by `JONEX_PLUGIN_DIR`

The environment-variable path is intended for development and testing.
