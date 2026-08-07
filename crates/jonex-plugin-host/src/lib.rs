use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use jonex_plugin_api::PluginManifest;
use serde::Serialize;

#[derive(Debug, Clone)]
pub struct PluginHost {
    roots: Vec<PathBuf>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginCatalog {
    pub plugins: Vec<PluginRecord>,
    pub diagnostics: Vec<PluginDiagnostic>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRecord {
    pub manifest: PluginManifest,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginDiagnostic {
    pub path: String,
    pub message: String,
}

impl PluginHost {
    #[must_use]
    pub fn new(roots: impl IntoIterator<Item = PathBuf>) -> Self {
        Self {
            roots: roots.into_iter().collect(),
        }
    }

    #[must_use]
    pub fn discover(&self) -> PluginCatalog {
        let mut plugins = Vec::new();
        let mut diagnostics = Vec::new();
        let mut identifiers = HashSet::new();

        for root in &self.roots {
            discover_root(root, &mut plugins, &mut diagnostics, &mut identifiers);
        }

        plugins.sort_by(|left, right| left.manifest.name.cmp(&right.manifest.name));
        diagnostics.sort_by(|left, right| left.path.cmp(&right.path));

        PluginCatalog {
            plugins,
            diagnostics,
        }
    }
}

fn discover_root(
    root: &Path,
    plugins: &mut Vec<PluginRecord>,
    diagnostics: &mut Vec<PluginDiagnostic>,
    identifiers: &mut HashSet<String>,
) {
    if !root.exists() {
        return;
    }

    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) => {
            diagnostics.push(PluginDiagnostic {
                path: root.display().to_string(),
                message: format!("unable to read plugin directory: {error}"),
            });
            return;
        }
    };

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                diagnostics.push(PluginDiagnostic {
                    path: root.display().to_string(),
                    message: format!("unable to read plugin directory entry: {error}"),
                });
                continue;
            }
        };

        let entry_path = entry.path();

        if !entry_path.is_dir() {
            continue;
        }

        let manifest_path = entry_path.join("manifest.json");

        if manifest_path.is_file() {
            discover_manifest(&manifest_path, plugins, diagnostics, identifiers);
        }
    }
}

fn discover_manifest(
    manifest_path: &Path,
    plugins: &mut Vec<PluginRecord>,
    diagnostics: &mut Vec<PluginDiagnostic>,
    identifiers: &mut HashSet<String>,
) {
    let source = match fs::read_to_string(manifest_path) {
        Ok(source) => source,
        Err(error) => {
            diagnostics.push(PluginDiagnostic {
                path: manifest_path.display().to_string(),
                message: format!("unable to read manifest: {error}"),
            });
            return;
        }
    };

    let manifest = match serde_json::from_str::<PluginManifest>(&source) {
        Ok(manifest) => manifest,
        Err(error) => {
            diagnostics.push(PluginDiagnostic {
                path: manifest_path.display().to_string(),
                message: format!("invalid manifest JSON: {error}"),
            });
            return;
        }
    };

    let validation_errors = manifest.validation_errors();

    if !validation_errors.is_empty() {
        diagnostics.push(PluginDiagnostic {
            path: manifest_path.display().to_string(),
            message: validation_errors.join("; "),
        });
        return;
    }

    if !identifiers.insert(manifest.id.clone()) {
        diagnostics.push(PluginDiagnostic {
            path: manifest_path.display().to_string(),
            message: format!("duplicate plugin identifier '{}'", manifest.id),
        });
        return;
    }

    plugins.push(PluginRecord {
        manifest,
        source_path: manifest_path.display().to_string(),
    });
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::PluginHost;

    #[test]
    fn discovers_valid_plugin_manifest() {
        let root = tempdir().expect("temporary directory should be created");
        let plugin_directory = root.path().join("example");

        fs::create_dir_all(&plugin_directory).expect("plugin directory should be created");
        fs::write(
            plugin_directory.join("manifest.json"),
            r#"{
                "schemaVersion": 1,
                "id": "jonex.example",
                "name": "Example",
                "version": "0.1.0",
                "description": "Example plugin",
                "publisher": "JØNEX",
                "entry": {
                    "kind": "widget",
                    "component": "example.widget"
                },
                "permissions": [],
                "capabilities": ["dashboard.widget"],
                "defaultEnabled": true
            }"#,
        )
        .expect("manifest should be written");

        let catalog = PluginHost::new([root.path().to_path_buf()]).discover();

        assert_eq!(catalog.plugins.len(), 1);
        assert!(catalog.diagnostics.is_empty());
        assert_eq!(catalog.plugins[0].manifest.id, "jonex.example");
    }

    #[test]
    fn rejects_duplicate_identifiers() {
        let root = tempdir().expect("temporary directory should be created");

        for directory_name in ["first", "second"] {
            let plugin_directory = root.path().join(directory_name);
            fs::create_dir_all(&plugin_directory).expect("plugin directory should be created");
            fs::write(
                plugin_directory.join("manifest.json"),
                r#"{
                    "schemaVersion": 1,
                    "id": "jonex.duplicate",
                    "name": "Duplicate",
                    "version": "0.1.0",
                    "description": "Duplicate plugin",
                    "publisher": "JØNEX",
                    "entry": {
                        "kind": "widget",
                        "component": "duplicate.widget"
                    },
                    "permissions": [],
                    "capabilities": ["dashboard.widget"],
                    "defaultEnabled": true
                }"#,
            )
            .expect("manifest should be written");
        }

        let catalog = PluginHost::new([root.path().to_path_buf()]).discover();

        assert_eq!(catalog.plugins.len(), 1);
        assert_eq!(catalog.diagnostics.len(), 1);
        assert!(catalog.diagnostics[0].message.contains("duplicate"));
    }
}
