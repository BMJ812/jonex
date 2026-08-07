use std::{env, path::PathBuf, sync::Mutex};

use jonex_core::{platform_info, PlatformInfo};
use jonex_plugin_host::{PluginCatalog, PluginHost};
use jonex_telemetry::{TelemetryService, TelemetrySnapshot};
use tauri::Manager;

struct JonexState {
    telemetry: Mutex<TelemetryService>,
    plugin_host: PluginHost,
}

#[tauri::command]
fn get_system_snapshot(state: tauri::State<'_, JonexState>) -> Result<TelemetrySnapshot, String> {
    let mut telemetry = state
        .telemetry
        .lock()
        .map_err(|_| "telemetry service lock was poisoned".to_owned())?;

    Ok(telemetry.sample())
}

#[tauri::command]
fn list_plugins(state: tauri::State<'_, JonexState>) -> PluginCatalog {
    state.plugin_host.discover()
}

#[tauri::command]
fn get_platform_info() -> PlatformInfo {
    platform_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(JonexState {
                telemetry: Mutex::new(TelemetryService::new()),
                plugin_host: PluginHost::new(plugin_roots(app)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_snapshot,
            list_plugins,
            get_platform_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running JØNEX");
}

fn plugin_roots(app: &tauri::App) -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../plugins")];

    if let Ok(application_data) = app.path().app_data_dir() {
        roots.push(application_data.join("plugins"));
    }

    if let Ok(development_path) = env::var("JONEX_PLUGIN_DIR") {
        if !development_path.trim().is_empty() {
            roots.push(PathBuf::from(development_path));
        }
    }

    roots
}
