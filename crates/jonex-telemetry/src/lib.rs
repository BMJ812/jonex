use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use sysinfo::{Disks, System};

#[derive(Debug)]
pub struct TelemetryService {
    system: System,
    disks: Disks,
    sequence: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySnapshot {
    pub sequence: u64,
    pub sampled_at_unix_ms: u64,
    pub host: HostSnapshot,
    pub cpu: CpuSnapshot,
    pub memory: MemorySnapshot,
    pub disks: Vec<DiskSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSnapshot {
    pub hostname: String,
    pub operating_system: String,
    pub kernel_version: String,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuSnapshot {
    pub usage_percent: f32,
    pub logical_cores: usize,
    pub physical_cores: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySnapshot {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSnapshot {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f64,
    pub removable: bool,
}

impl Default for TelemetryService {
    fn default() -> Self {
        Self::new()
    }
}

impl TelemetryService {
    #[must_use]
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
            disks: Disks::new_with_refreshed_list(),
            sequence: 0,
        }
    }

    #[must_use]
    pub fn sample(&mut self) -> TelemetrySnapshot {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.disks.refresh(true);
        self.sequence = self.sequence.saturating_add(1);

        let total_memory = self.system.total_memory();
        let used_memory = self.system.used_memory();
        let available_memory = self.system.available_memory();

        let mut disks = self
            .disks
            .list()
            .iter()
            .map(|disk| {
                let total = disk.total_space();
                let available = disk.available_space();
                let used = total.saturating_sub(available);

                DiskSnapshot {
                    name: disk.name().to_string_lossy().into_owned(),
                    mount_point: disk.mount_point().to_string_lossy().into_owned(),
                    total_bytes: total,
                    used_bytes: used,
                    available_bytes: available,
                    usage_percent: percentage(used, total),
                    removable: disk.is_removable(),
                }
            })
            .collect::<Vec<_>>();

        disks.sort_by(|left, right| left.mount_point.cmp(&right.mount_point));

        TelemetrySnapshot {
            sequence: self.sequence,
            sampled_at_unix_ms: current_unix_milliseconds(),
            host: HostSnapshot {
                hostname: System::host_name().unwrap_or_else(|| "unknown-host".to_owned()),
                operating_system: System::long_os_version()
                    .or_else(System::name)
                    .unwrap_or_else(|| std::env::consts::OS.to_owned()),
                kernel_version: System::kernel_version().unwrap_or_else(|| "unknown".to_owned()),
                uptime_seconds: System::uptime(),
            },
            cpu: CpuSnapshot {
                usage_percent: round_f32(self.system.global_cpu_usage()),
                logical_cores: self.system.cpus().len(),
                physical_cores: System::physical_core_count().unwrap_or(0),
            },
            memory: MemorySnapshot {
                total_bytes: total_memory,
                used_bytes: used_memory,
                available_bytes: available_memory,
                usage_percent: percentage(used_memory, total_memory),
            },
            disks,
        }
    }
}

fn current_unix_milliseconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn percentage(value: u64, total: u64) -> f64 {
    if total == 0 {
        return 0.0;
    }

    ((value as f64 / total as f64) * 1000.0).round() / 10.0
}

fn round_f32(value: f32) -> f32 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::{percentage, TelemetryService};

    #[test]
    fn calculates_percentage() {
        assert_eq!(percentage(50, 100), 50.0);
        assert_eq!(percentage(1, 0), 0.0);
    }

    #[test]
    fn produces_monotonic_snapshot_sequence() {
        let mut service = TelemetryService::new();

        let first = service.sample();
        let second = service.sample();

        assert_eq!(second.sequence, first.sequence + 1);
        assert!(!second.host.hostname.is_empty());
    }
}
