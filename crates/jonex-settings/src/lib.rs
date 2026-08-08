use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

const VALID_MODULES: &[&str] = &[
    "dashboard",
    "systems",
    "containers",
    "automation",
    "media",
    "development",
    "plugins",
    "settings",
];

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct JonexSettings {
    pub schema_version: u32,
    pub last_module: String,
    pub plugin_states: BTreeMap<String, bool>,
    pub dashboard_widget_order: Vec<String>,
    pub updated_at_unix_ms: u64,
}

impl Default for JonexSettings {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            last_module: "dashboard".to_owned(),
            plugin_states: BTreeMap::new(),
            dashboard_widget_order: Vec::new(),
            updated_at_unix_ms: 0,
        }
    }
}

impl JonexSettings {
    pub fn normalized(mut self) -> Self {
        self.schema_version = CURRENT_SCHEMA_VERSION;

        if !VALID_MODULES.contains(&self.last_module.as_str()) {
            self.last_module = "dashboard".to_owned();
        }

        self.plugin_states
            .retain(|plugin_id, _| !plugin_id.trim().is_empty());

        let mut seen = HashSet::new();
        self.dashboard_widget_order
            .retain(|plugin_id| !plugin_id.trim().is_empty() && seen.insert(plugin_id.clone()));

        self
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SettingsLoadSource {
    Default,
    Stored,
    Migrated,
    Recovered,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsLoadResult {
    pub settings: JonexSettings,
    pub source: SettingsLoadSource,
    pub storage_path: String,
    pub backup_path: Option<String>,
}

#[derive(Clone, Debug)]
pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<SettingsLoadResult, String> {
        if !self.path.exists() {
            return Ok(self.result(JonexSettings::default(), SettingsLoadSource::Default, None));
        }

        let bytes = fs::read(&self.path).map_err(|error| {
            format!(
                "failed to read settings file {}: {error}",
                self.path.display()
            )
        })?;

        let value: serde_json::Value = match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(error) => {
                return self.recover_corrupt(format!("invalid JSON: {error}"));
            }
        };

        let schema_version = value
            .get("schemaVersion")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(0);

        match schema_version {
            0 => {
                let legacy: LegacySettingsV0 = serde_json::from_value(value).map_err(|error| {
                    format!("failed to decode legacy settings schema 0: {error}")
                })?;

                let mut settings = JonexSettings {
                    last_module: if legacy.last_module.trim().is_empty() {
                        "dashboard".to_owned()
                    } else {
                        legacy.last_module
                    },
                    dashboard_widget_order: legacy.dashboard_widget_order,
                    ..JonexSettings::default()
                };

                for plugin_id in legacy.disabled_plugins {
                    settings.plugin_states.insert(plugin_id, false);
                }

                let saved = self.save(settings)?;

                Ok(self.result(saved, SettingsLoadSource::Migrated, None))
            }
            version if version == CURRENT_SCHEMA_VERSION as u64 => {
                let settings: JonexSettings =
                    serde_json::from_value(value).map_err(|error| {
                        format!("failed to decode settings schema 1: {error}")
                    })?;

                Ok(self.result(
                    settings.normalized(),
                    SettingsLoadSource::Stored,
                    None,
                ))
            }
            version if version > CURRENT_SCHEMA_VERSION as u64 => Err(format!(
                "settings schema {version} is newer than this JØNEX build supports ({CURRENT_SCHEMA_VERSION})"
            )),
            version => Err(format!("unsupported settings schema version {version}")),
        }
    }

    pub fn save(&self, settings: JonexSettings) -> Result<JonexSettings, String> {
        let parent = self.path.parent().ok_or_else(|| {
            format!(
                "settings path has no parent directory: {}",
                self.path.display()
            )
        })?;

        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create settings directory {}: {error}",
                parent.display()
            )
        })?;

        let mut settings = settings.normalized();
        settings.updated_at_unix_ms = unix_time_ms()?;

        let mut bytes = serde_json::to_vec_pretty(&settings)
            .map_err(|error| format!("failed to serialize settings: {error}"))?;
        bytes.push(b'\n');

        let mut temporary = NamedTempFile::new_in(parent).map_err(|error| {
            format!(
                "failed to create temporary settings file in {}: {error}",
                parent.display()
            )
        })?;

        temporary
            .write_all(&bytes)
            .map_err(|error| format!("failed to write temporary settings file: {error}"))?;

        temporary
            .flush()
            .map_err(|error| format!("failed to flush temporary settings file: {error}"))?;

        temporary
            .as_file()
            .sync_all()
            .map_err(|error| format!("failed to sync temporary settings file: {error}"))?;

        let persisted = temporary.persist(&self.path).map_err(|error| {
            format!(
                "failed to atomically replace settings file {}: {}",
                self.path.display(),
                error.error
            )
        })?;

        persisted
            .sync_all()
            .map_err(|error| format!("failed to sync persisted settings file: {error}"))?;

        sync_parent_directory(parent)?;

        Ok(settings)
    }

    pub fn reset(&self) -> Result<JonexSettings, String> {
        self.save(JonexSettings::default())
    }

    fn recover_corrupt(&self, reason: String) -> Result<SettingsLoadResult, String> {
        let backup_path = self.corrupt_backup_path()?;

        fs::rename(&self.path, &backup_path).map_err(|error| {
            format!(
                "settings were malformed ({reason}) and backup failed from {} to {}: {error}",
                self.path.display(),
                backup_path.display()
            )
        })?;

        let settings = self.save(JonexSettings::default())?;

        Ok(self.result(settings, SettingsLoadSource::Recovered, Some(backup_path)))
    }

    fn corrupt_backup_path(&self) -> Result<PathBuf, String> {
        let timestamp = unix_time_ms()?;
        let parent = self.path.parent().ok_or_else(|| {
            format!(
                "settings path has no parent directory: {}",
                self.path.display()
            )
        })?;

        Ok(parent.join(format!("settings.corrupt-{timestamp}.json")))
    }

    fn result(
        &self,
        settings: JonexSettings,
        source: SettingsLoadSource,
        backup_path: Option<PathBuf>,
    ) -> SettingsLoadResult {
        SettingsLoadResult {
            settings,
            source,
            storage_path: self.path.display().to_string(),
            backup_path: backup_path.map(|path| path.display().to_string()),
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct LegacySettingsV0 {
    last_module: String,
    disabled_plugins: Vec<String>,
    dashboard_widget_order: Vec<String>,
}

fn unix_time_ms() -> Result<u64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock is before Unix epoch: {error}"))?;

    u64::try_from(duration.as_millis())
        .map_err(|_| "system clock timestamp exceeds supported range".to_owned())
}

fn sync_parent_directory(parent: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        let directory = fs::File::open(parent).map_err(|error| {
            format!(
                "failed to open settings directory {} for sync: {error}",
                parent.display()
            )
        })?;

        directory.sync_all().map_err(|error| {
            format!(
                "failed to sync settings directory {}: {error}",
                parent.display()
            )
        })?;
    }

    #[cfg(not(unix))]
    {
        let _ = parent;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn store_in_temp() -> (tempfile::TempDir, SettingsStore) {
        let root = tempdir().expect("tempdir");
        let store = SettingsStore::new(root.path().join("settings").join("settings.json"));
        (root, store)
    }

    #[test]
    fn missing_file_returns_sensible_defaults() {
        let (_root, store) = store_in_temp();

        let loaded = store.load().expect("load defaults");

        assert_eq!(loaded.source, SettingsLoadSource::Default);
        assert_eq!(loaded.settings.last_module, "dashboard");
        assert_eq!(loaded.settings.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(loaded.settings.plugin_states.is_empty());
    }

    #[test]
    fn save_and_load_round_trip() {
        let (_root, store) = store_in_temp();

        let mut settings = JonexSettings {
            last_module: "settings".to_owned(),
            dashboard_widget_order: vec![
                "jonex.system-overview".to_owned(),
                "jonex.local-clock".to_owned(),
            ],
            ..JonexSettings::default()
        };
        settings
            .plugin_states
            .insert("jonex.local-clock".to_owned(), false);

        let saved = store.save(settings).expect("save settings");
        let loaded = store.load().expect("load settings");

        assert!(saved.updated_at_unix_ms > 0);
        assert_eq!(loaded.source, SettingsLoadSource::Stored);
        assert_eq!(loaded.settings, saved);
    }

    #[test]
    fn migrates_schema_zero() {
        let (_root, store) = store_in_temp();
        let parent = store.path().parent().expect("parent");

        fs::create_dir_all(parent).expect("create settings dir");
        fs::write(
            store.path(),
            r#"{
  "schemaVersion": 0,
  "lastModule": "systems",
  "disabledPlugins": ["jonex.local-clock"],
  "dashboardWidgetOrder": ["jonex.system-overview", "jonex.local-clock"]
}"#,
        )
        .expect("write legacy");

        let loaded = store.load().expect("migrate settings");

        assert_eq!(loaded.source, SettingsLoadSource::Migrated);
        assert_eq!(loaded.settings.schema_version, CURRENT_SCHEMA_VERSION);
        assert_eq!(loaded.settings.last_module, "systems");
        assert_eq!(
            loaded.settings.plugin_states.get("jonex.local-clock"),
            Some(&false)
        );

        let reloaded = store.load().expect("reload migrated settings");
        assert_eq!(reloaded.source, SettingsLoadSource::Stored);
    }

    #[test]
    fn malformed_json_is_backed_up_and_recovered() {
        let (_root, store) = store_in_temp();
        let parent = store.path().parent().expect("parent");

        fs::create_dir_all(parent).expect("create settings dir");
        fs::write(store.path(), "{ definitely-not-json").expect("write malformed file");

        let loaded = store.load().expect("recover malformed settings");

        assert_eq!(loaded.source, SettingsLoadSource::Recovered);
        assert_eq!(loaded.settings.last_module, "dashboard");
        assert!(loaded.settings.updated_at_unix_ms > 0);

        let backup = loaded.backup_path.expect("backup path");
        assert!(Path::new(&backup).exists());
        assert!(store.path().exists());
    }

    #[test]
    fn normalization_rejects_invalid_module_and_duplicate_order_entries() {
        let settings = JonexSettings {
            last_module: "not-a-module".to_owned(),
            dashboard_widget_order: vec![
                "jonex.local-clock".to_owned(),
                "jonex.local-clock".to_owned(),
                "".to_owned(),
            ],
            ..JonexSettings::default()
        }
        .normalized();

        assert_eq!(settings.last_module, "dashboard");
        assert_eq!(
            settings.dashboard_widget_order,
            vec!["jonex.local-clock".to_owned()]
        );
    }
}
