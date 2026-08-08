# Settings storage

## Native location

JØNEX stores its settings inside the platform application-data directory under:

`settings/settings.json`

On Windows this normally resolves beneath the current user's local application
data directory for `io.jonex.platform`.

The exact resolved path is shown in the JØNEX Settings module.

## Schema

Current schema: `1`

Schema 1 contains:

- `schemaVersion`
- `lastModule`
- `pluginStates`
- `dashboardWidgetOrder`
- `updatedAtUnixMs`

## Recovery

Malformed JSON is not overwritten in place. JØNEX moves it to:

`settings/settings.corrupt-<timestamp>.json`

and writes a new default schema-1 settings file.

The Settings screen reports when recovery occurred and displays the backup path.

A settings file whose schema version is newer than the running JØNEX build is
treated as incompatible. It is not automatically replaced.

## Reset

The Settings module can restore the local state profile to defaults. Resetting
state does not remove runtime logs, plugin manifests, or application binaries.