use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServiceKind {
    HomeAssistant,
    Unraid,
    Jellyfin,
    Plex,
    Generic,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRecord {
    pub id: String,
    pub kind: ServiceKind,
    pub name: String,
    pub base_url: String,
    pub enabled: bool,
}

impl ServiceRecord {
    fn normalized(mut self) -> Result<Self, String> {
        self.id = self.id.trim().to_owned();
        self.name = self.name.trim().to_owned();

        let base_url = self.base_url.trim();

        if self.id.is_empty() {
            return Err("service id cannot be empty".to_owned());
        }

        if self.name.is_empty() {
            return Err(format!("service {} must have a display name", self.id));
        }

        if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
            return Err(format!(
                "service {} base URL must begin with http:// or https://",
                self.id
            ));
        }

        if matches!(base_url, "http://" | "https://") {
            return Err(format!("service {} base URL is incomplete", self.id));
        }

        self.base_url = base_url.trim_end_matches('/').to_owned();

        Ok(self)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRegistry {
    pub schema_version: u32,
    pub services: Vec<ServiceRecord>,
    pub updated_at_unix_ms: u64,
}

impl Default for ServiceRegistry {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            services: Vec::new(),
            updated_at_unix_ms: 0,
        }
    }
}

impl ServiceRegistry {
    pub fn normalized(mut self) -> Result<Self, String> {
        self.schema_version = CURRENT_SCHEMA_VERSION;

        let mut ids = HashSet::new();
        let mut services = Vec::with_capacity(self.services.len());

        for service in self.services {
            let service = service.normalized()?;

            if !ids.insert(service.id.clone()) {
                return Err(format!("duplicate service id: {}", service.id));
            }

            services.push(service);
        }

        self.services = services;

        Ok(self)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceRegistryLoadSource {
    Default,
    Stored,
    Recovered,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRegistryLoadResult {
    pub registry: ServiceRegistry,
    pub source: ServiceRegistryLoadSource,
    pub storage_path: String,
    pub backup_path: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ServiceRegistryStore {
    path: PathBuf,
}

impl ServiceRegistryStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<ServiceRegistryLoadResult, String> {
        if !self.path.exists() {
            return Ok(self.result(
                ServiceRegistry::default(),
                ServiceRegistryLoadSource::Default,
                None,
            ));
        }

        let bytes = fs::read(&self.path).map_err(|error| {
            format!(
                "failed to read service registry {}: {error}",
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

        if schema_version != CURRENT_SCHEMA_VERSION as u64 {
            return Err(format!(
                "service registry schema {schema_version} is unsupported; expected {CURRENT_SCHEMA_VERSION}"
            ));
        }

        let registry: ServiceRegistry = serde_json::from_value(value)
            .map_err(|error| format!("failed to decode service registry: {error}"))?;

        Ok(self.result(
            registry.normalized()?,
            ServiceRegistryLoadSource::Stored,
            None,
        ))
    }

    pub fn save(&self, registry: ServiceRegistry) -> Result<ServiceRegistry, String> {
        let parent = self.path.parent().ok_or_else(|| {
            format!(
                "service registry path has no parent directory: {}",
                self.path.display()
            )
        })?;

        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create service registry directory {}: {error}",
                parent.display()
            )
        })?;

        let mut registry = registry.normalized()?;
        registry.updated_at_unix_ms = unix_time_ms()?;

        let mut bytes = serde_json::to_vec_pretty(&registry)
            .map_err(|error| format!("failed to serialize service registry: {error}"))?;
        bytes.push(b'\n');

        let mut temporary = NamedTempFile::new_in(parent).map_err(|error| {
            format!(
                "failed to create temporary service registry in {}: {error}",
                parent.display()
            )
        })?;

        temporary
            .write_all(&bytes)
            .map_err(|error| format!("failed to write temporary service registry: {error}"))?;

        temporary
            .flush()
            .map_err(|error| format!("failed to flush temporary service registry: {error}"))?;

        temporary
            .as_file()
            .sync_all()
            .map_err(|error| format!("failed to sync temporary service registry: {error}"))?;

        let persisted = temporary.persist(&self.path).map_err(|error| {
            format!(
                "failed to atomically replace service registry {}: {}",
                self.path.display(),
                error.error
            )
        })?;

        persisted
            .sync_all()
            .map_err(|error| format!("failed to sync persisted service registry: {error}"))?;

        sync_parent_directory(parent)?;

        Ok(registry)
    }

    fn recover_corrupt(&self, reason: String) -> Result<ServiceRegistryLoadResult, String> {
        let parent = self.path.parent().ok_or_else(|| {
            format!(
                "service registry path has no parent directory: {}",
                self.path.display()
            )
        })?;

        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create service registry directory {}: {error}",
                parent.display()
            )
        })?;

        let backup_path = parent.join(format!("registry.corrupt-{}.json", unix_time_ms()?));

        fs::rename(&self.path, &backup_path).map_err(|error| {
            format!(
                "service registry was malformed ({reason}) and backup failed from {} to {}: {error}",
                self.path.display(),
                backup_path.display()
            )
        })?;

        let registry = self.save(ServiceRegistry::default())?;

        Ok(self.result(
            registry,
            ServiceRegistryLoadSource::Recovered,
            Some(backup_path),
        ))
    }

    fn result(
        &self,
        registry: ServiceRegistry,
        source: ServiceRegistryLoadSource,
        backup_path: Option<PathBuf>,
    ) -> ServiceRegistryLoadResult {
        ServiceRegistryLoadResult {
            registry,
            source,
            storage_path: self.path.display().to_string(),
            backup_path: backup_path.map(|path| path.display().to_string()),
        }
    }
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
                "failed to open service registry directory {} for sync: {error}",
                parent.display()
            )
        })?;

        directory.sync_all().map_err(|error| {
            format!(
                "failed to sync service registry directory {}: {error}",
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

    fn store_in_temp() -> (tempfile::TempDir, ServiceRegistryStore) {
        let root = tempdir().expect("tempdir");
        let store = ServiceRegistryStore::new(root.path().join("services").join("registry.json"));
        (root, store)
    }

    fn home_assistant() -> ServiceRecord {
        ServiceRecord {
            id: "home-assistant".to_owned(),
            kind: ServiceKind::HomeAssistant,
            name: "Home Assistant".to_owned(),
            base_url: "http://homeassistant.local:8123/".to_owned(),
            enabled: true,
        }
    }

    #[test]
    fn missing_registry_returns_empty_default() {
        let (_root, store) = store_in_temp();
        let loaded = store.load().expect("load default");

        assert_eq!(loaded.source, ServiceRegistryLoadSource::Default);
        assert!(loaded.registry.services.is_empty());
        assert_eq!(loaded.registry.schema_version, CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn save_and_load_round_trip() {
        let (_root, store) = store_in_temp();
        let registry = ServiceRegistry {
            services: vec![home_assistant()],
            ..ServiceRegistry::default()
        };

        let saved = store.save(registry).expect("save registry");
        let loaded = store.load().expect("load registry");

        assert!(saved.updated_at_unix_ms > 0);
        assert_eq!(
            saved.services[0].base_url,
            "http://homeassistant.local:8123"
        );
        assert_eq!(loaded.source, ServiceRegistryLoadSource::Stored);
        assert_eq!(loaded.registry, saved);
    }

    #[test]
    fn duplicate_ids_are_rejected() {
        let registry = ServiceRegistry {
            services: vec![home_assistant(), home_assistant()],
            ..ServiceRegistry::default()
        };

        let error = registry.normalized().expect_err("duplicate id");

        assert!(error.contains("duplicate service id"));
    }

    #[test]
    fn invalid_scheme_is_rejected() {
        let mut service = home_assistant();
        service.base_url = "homeassistant.local:8123".to_owned();

        let registry = ServiceRegistry {
            services: vec![service],
            ..ServiceRegistry::default()
        };

        let error = registry.normalized().expect_err("invalid scheme");

        assert!(error.contains("http:// or https://"));
    }

    #[test]
    fn malformed_json_is_backed_up_and_recovered() {
        let (_root, store) = store_in_temp();
        let parent = store.path().parent().expect("parent");

        fs::create_dir_all(parent).expect("create directory");
        fs::write(store.path(), "{broken").expect("write malformed registry");

        let loaded = store.load().expect("recover registry");

        assert_eq!(loaded.source, ServiceRegistryLoadSource::Recovered);
        assert!(loaded.registry.services.is_empty());
        assert!(loaded.backup_path.is_some());
        assert!(store.path().exists());
    }
}
