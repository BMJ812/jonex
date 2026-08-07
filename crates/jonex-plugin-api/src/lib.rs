use semver::Version;
use serde::{Deserialize, Serialize};

pub const PLUGIN_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub publisher: String,
    pub entry: PluginEntry,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default = "default_enabled")]
    pub default_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntry {
    pub kind: PluginEntryKind,
    pub component: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginEntryKind {
    Widget,
    Integration,
    Service,
}

const fn default_enabled() -> bool {
    true
}

impl PluginManifest {
    #[must_use]
    pub fn validation_errors(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if self.schema_version != PLUGIN_SCHEMA_VERSION {
            errors.push(format!(
                "unsupported schema version {}; expected {}",
                self.schema_version, PLUGIN_SCHEMA_VERSION
            ));
        }

        if !is_valid_identifier(&self.id) {
            errors.push(
                "id must begin with a lowercase letter or number and contain only lowercase letters, numbers, periods, or hyphens"
                    .to_owned(),
            );
        }

        if self.name.trim().is_empty() {
            errors.push("name cannot be empty".to_owned());
        }

        if self.publisher.trim().is_empty() {
            errors.push("publisher cannot be empty".to_owned());
        }

        if Version::parse(&self.version).is_err() {
            errors.push("version must be valid Semantic Versioning".to_owned());
        }

        if self.entry.component.trim().is_empty() {
            errors.push("entry.component cannot be empty".to_owned());
        }

        errors
    }
}

#[must_use]
pub fn is_valid_identifier(value: &str) -> bool {
    let mut characters = value.chars();

    let Some(first) = characters.next() else {
        return false;
    };

    if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return false;
    }

    characters.all(|character| {
        character.is_ascii_lowercase()
            || character.is_ascii_digit()
            || character == '.'
            || character == '-'
    })
}

#[cfg(test)]
mod tests {
    use super::{
        is_valid_identifier, PluginEntry, PluginEntryKind, PluginManifest, PLUGIN_SCHEMA_VERSION,
    };

    fn valid_manifest() -> PluginManifest {
        PluginManifest {
            schema_version: PLUGIN_SCHEMA_VERSION,
            id: "jonex.example-plugin".to_owned(),
            name: "Example".to_owned(),
            version: "0.1.0".to_owned(),
            description: "Example plugin".to_owned(),
            publisher: "JØNEX".to_owned(),
            entry: PluginEntry {
                kind: PluginEntryKind::Widget,
                component: "example.widget".to_owned(),
            },
            permissions: Vec::new(),
            capabilities: vec!["dashboard.widget".to_owned()],
            default_enabled: true,
        }
    }

    #[test]
    fn accepts_valid_identifiers() {
        assert!(is_valid_identifier("jonex.system-overview"));
        assert!(is_valid_identifier("7segment.clock"));
    }

    #[test]
    fn rejects_unsafe_identifiers() {
        assert!(!is_valid_identifier(""));
        assert!(!is_valid_identifier("JONEX.Plugin"));
        assert!(!is_valid_identifier("../plugin"));
        assert!(!is_valid_identifier("plugin_name"));
    }

    #[test]
    fn accepts_valid_manifest() {
        assert!(valid_manifest().validation_errors().is_empty());
    }

    #[test]
    fn rejects_invalid_version() {
        let mut manifest = valid_manifest();
        manifest.version = "release-one".to_owned();

        assert_eq!(manifest.validation_errors().len(), 1);
    }
}
