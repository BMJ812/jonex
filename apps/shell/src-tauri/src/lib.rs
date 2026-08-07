use std::{env, path::PathBuf, sync::Mutex};

use jonex_core::{platform_info, PlatformInfo};
use jonex_plugin_host::{PluginCatalog, PluginHost};
use jonex_telemetry::{TelemetryService, TelemetrySnapshot};
use log::{debug, error, info, warn, LevelFilter};
use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, TimezoneStrategy};

struct JonexState {
    telemetry: Mutex<TelemetryService>,
    plugin_host: PluginHost,
}

#[tauri::command]
fn get_system_snapshot(state: tauri::State<'_, JonexState>) -> Result<TelemetrySnapshot, String> {
    let mut telemetry = state.telemetry.lock().map_err(|_| {
        error!(
            target: "jonex::telemetry",
            "telemetry service lock was poisoned"
        );
        "telemetry service lock was poisoned".to_owned()
    })?;

    let snapshot = telemetry.sample();

    debug!(
        target: "jonex::telemetry",
        "sampled telemetry sequence={} cpu_usage={:.1} memory_usage={:.1}",
        snapshot.sequence,
        snapshot.cpu.usage_percent,
        snapshot.memory.usage_percent
    );

    Ok(snapshot)
}

#[tauri::command]
fn list_plugins(state: tauri::State<'_, JonexState>) -> PluginCatalog {
    let catalog = state.plugin_host.discover();

    if catalog.diagnostics.is_empty() {
        debug!(
            target: "jonex::plugins",
            "plugin discovery completed plugins={} diagnostics=0",
            catalog.plugins.len()
        );
    } else {
        warn!(
            target: "jonex::plugins",
            "plugin discovery completed plugins={} diagnostics={}",
            catalog.plugins.len(),
            catalog.diagnostics.len()
        );
    }

    catalog
}

#[tauri::command]
fn get_platform_info() -> PlatformInfo {
    let info = platform_info();

    debug!(
        target: "jonex::runtime",
        "platform information requested target={}/{} debug={}",
        info.target_os,
        info.target_arch,
        info.debug_build
    );

    info
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let jonex_level = if cfg!(debug_assertions) {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    };

    let log_plugin = tauri_plugin_log::Builder::new()
        .level(LevelFilter::Info)
        .level_for("jonex_shell_lib", jonex_level)
        .max_file_size(5_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .build();

    let result = tauri::Builder::default()
        .plugin(log_plugin)
        .setup(|app| {
            let roots = plugin_roots(app);

            info!(
                target: "jonex::runtime",
                "JØNEX runtime starting version={} target={}/{} plugin_roots={}",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH,
                roots.len()
            );

            app.manage(JonexState {
                telemetry: Mutex::new(TelemetryService::new()),
                plugin_host: PluginHost::new(roots),
            });

            info!(target: "jonex::runtime", "native services initialized");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_snapshot,
            list_plugins,
            get_platform_info,
        ])
        .run(tauri::generate_context!());

    if let Err(runtime_error) = result {
        error!(
            target: "jonex::runtime",
            "fatal Tauri runtime error: {runtime_error}"
        );
        panic!("error while running JØNEX: {runtime_error}");
    }
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
