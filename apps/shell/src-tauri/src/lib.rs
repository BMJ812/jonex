use std::{env, path::PathBuf, sync::Mutex};

use jonex_core::{platform_info, PlatformInfo};
use jonex_plugin_host::{PluginCatalog, PluginHost};
use jonex_service_health::{probe_service, ServiceHealthStatus, ServiceProbeResult};
use jonex_service_registry::{
    ServiceRecord, ServiceRegistry, ServiceRegistryLoadResult, ServiceRegistryStore,
};
use jonex_settings::{JonexSettings, SettingsLoadResult, SettingsLoadSource, SettingsStore};
use jonex_telemetry::{TelemetryService, TelemetrySnapshot};
use log::{debug, error, info, warn, LevelFilter};
use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, TimezoneStrategy};

struct JonexState {
    telemetry: Mutex<TelemetryService>,
    plugin_host: PluginHost,
    settings_store: Mutex<SettingsStore>,
    service_registry_store: Mutex<ServiceRegistryStore>,
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

#[tauri::command]
fn get_settings(state: tauri::State<'_, JonexState>) -> Result<SettingsLoadResult, String> {
    let store = state
        .settings_store
        .lock()
        .map_err(|_| "settings store lock was poisoned".to_owned())?;

    let loaded = store.load()?;

    info!(
        target: "jonex::settings",
        "settings loaded source={:?} path={}",
        loaded.source,
        loaded.storage_path
    );

    if let Some(backup_path) = &loaded.backup_path {
        warn!(
            target: "jonex::settings",
            "malformed settings were recovered backup={backup_path}"
        );
    }

    Ok(loaded)
}

#[tauri::command]
fn save_settings(
    state: tauri::State<'_, JonexState>,
    settings: JonexSettings,
) -> Result<JonexSettings, String> {
    let store = state
        .settings_store
        .lock()
        .map_err(|_| "settings store lock was poisoned".to_owned())?;

    let saved = store.save(settings)?;

    debug!(
        target: "jonex::settings",
        "settings saved last_module={} plugin_overrides={} widget_order={}",
        saved.last_module,
        saved.plugin_states.len(),
        saved.dashboard_widget_order.len()
    );

    Ok(saved)
}

#[tauri::command]
fn reset_settings(state: tauri::State<'_, JonexState>) -> Result<SettingsLoadResult, String> {
    let store = state
        .settings_store
        .lock()
        .map_err(|_| "settings store lock was poisoned".to_owned())?;

    let settings = store.reset()?;

    info!(target: "jonex::settings", "settings reset to defaults");

    Ok(SettingsLoadResult {
        settings,
        source: SettingsLoadSource::Default,
        storage_path: store.path().display().to_string(),
        backup_path: None,
    })
}

#[tauri::command]
fn get_service_registry(
    state: tauri::State<'_, JonexState>,
) -> Result<ServiceRegistryLoadResult, String> {
    let store = state
        .service_registry_store
        .lock()
        .map_err(|_| "service registry store lock was poisoned".to_owned())?;

    let loaded = store.load()?;

    info!(
        target: "jonex::services",
        "service registry loaded source={:?} services={} path={}",
        loaded.source,
        loaded.registry.services.len(),
        loaded.storage_path
    );

    if let Some(backup_path) = &loaded.backup_path {
        warn!(
            target: "jonex::services",
            "malformed service registry was recovered backup={backup_path}"
        );
    }

    Ok(loaded)
}

#[tauri::command]
fn save_service_registry(
    state: tauri::State<'_, JonexState>,
    registry: ServiceRegistry,
) -> Result<ServiceRegistry, String> {
    let store = state
        .service_registry_store
        .lock()
        .map_err(|_| "service registry store lock was poisoned".to_owned())?;

    let saved = store.save(registry)?;

    info!(
        target: "jonex::services",
        "service registry saved services={} path={}",
        saved.services.len(),
        store.path().display()
    );

    Ok(saved)
}

#[tauri::command]
async fn probe_remote_service(service: ServiceRecord) -> ServiceProbeResult {
    let service_name = service.name.clone();
    let service_id = service.id.clone();
    let result = probe_service(&service).await;

    match result.status {
        ServiceHealthStatus::Online => {
            info!(
                target: "jonex::services",
                "service probe online id={} name={} status={:?} latency_ms={}",
                service_id,
                service_name,
                result.http_status,
                result.latency_ms
            );
        }
        ServiceHealthStatus::AuthRequired => {
            info!(
                target: "jonex::services",
                "service probe requires authentication id={} name={} status={:?} latency_ms={}",
                service_id,
                service_name,
                result.http_status,
                result.latency_ms
            );
        }
        ServiceHealthStatus::Offline | ServiceHealthStatus::Fault => {
            warn!(
                target: "jonex::services",
                "service probe unavailable id={} name={} health={:?} status={:?} detail={}",
                service_id,
                service_name,
                result.status,
                result.http_status,
                result.detail
            );
        }
    }

    result
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
        .level_for("jonex::settings", jonex_level)
        .level_for("jonex::services", jonex_level)
        .level_for("jonex::credentials", jonex_level)
        .max_file_size(5_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .build();

    let result = tauri::Builder::default()
        .plugin(log_plugin)
        .setup(|app| {
            let roots = plugin_roots(app);
            let application_data = app.path().app_data_dir()?;
            let local_application_data = app.path().app_local_data_dir()?;
            let settings_path = application_data.join("settings").join("settings.json");
            let service_registry_path = application_data.join("services").join("registry.json");
            let stronghold_salt_path = local_application_data.join("stronghold-salt.txt");

            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&stronghold_salt_path).build(),
            )?;

            info!(
                target: "jonex::runtime",
                "JØNEX runtime starting version={} target={}/{} plugin_roots={}",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH,
                roots.len()
            );

            info!(
                target: "jonex::settings",
                "settings store initialized path={}",
                settings_path.display()
            );

            info!(
                target: "jonex::services",
                "service registry initialized path={}",
                service_registry_path.display()
            );

            info!(
                target: "jonex::credentials",
                "credential vault engine initialized"
            );

            app.manage(JonexState {
                telemetry: Mutex::new(TelemetryService::new()),
                plugin_host: PluginHost::new(roots),
                settings_store: Mutex::new(SettingsStore::new(settings_path)),
                service_registry_store: Mutex::new(ServiceRegistryStore::new(
                    service_registry_path,
                )),
            });

            info!(target: "jonex::runtime", "native services initialized");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_snapshot,
            list_plugins,
            get_platform_info,
            get_settings,
            save_settings,
            reset_settings,
            get_service_registry,
            save_service_registry,
            probe_remote_service,
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
