use std::{
    collections::HashSet,
    time::{SystemTime, UNIX_EPOCH},
};

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
            .filter(|disk| {
                let file_system = disk.file_system().to_string_lossy();

                !is_virtual_file_system(&file_system)
            })
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

        disks.sort_by(|left, right| {
            disk_priority(&left.mount_point)
                .cmp(&disk_priority(&right.mount_point))
                .then_with(|| right.total_bytes.cmp(&left.total_bytes))
                .then_with(|| left.mount_point.cmp(&right.mount_point))
        });

        /*
         * Fedora Atomic exposes the same backing Btrfs filesystem through
         * several persistent mount points such as /var, /var/home, /etc,
         * and /sysroot. Keep the highest-priority representative instead
         * of reporting the same physical storage repeatedly.
         */
        let mut seen_disks = HashSet::new();

        disks.retain(|disk| seen_disks.insert((disk.name.clone(), disk.total_bytes)));

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

fn is_virtual_file_system(file_system: &str) -> bool {
    matches!(
        file_system.to_ascii_lowercase().as_str(),
        "overlay"
            | "composefs"
            | "tmpfs"
            | "devtmpfs"
            | "proc"
            | "sysfs"
            | "cgroup"
            | "cgroup2"
            | "ramfs"
            | "squashfs"
    )
}

#[cfg(target_os = "windows")]
fn disk_priority(mount_point: &str) -> u8 {
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_owned());

    if mount_point
        .to_ascii_lowercase()
        .starts_with(&system_drive.to_ascii_lowercase())
    {
        0
    } else {
        10
    }
}

#[cfg(not(target_os = "windows"))]
fn disk_priority(mount_point: &str) -> u8 {
    match mount_point {
        "/" => 0,

        /*
         * Fedora Atomic's immutable root is normally filtered above.
         * /var/home is then the preferred representation of the persistent
         * host filesystem.
         */
        "/var/home" => 1,
        "/home" => 2,
        "/var" => 3,
        "/sysroot" => 4,

        "/boot" => 20,
        "/boot/efi" => 21,

        _ => 10,
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
    use super::{disk_priority, is_virtual_file_system, percentage, TelemetryService};

    #[test]
    fn calculates_percentage() {
        assert_eq!(percentage(50, 100), 50.0);
        assert_eq!(percentage(1, 0), 0.0);
    }

    #[test]
    fn rejects_virtual_linux_file_systems() {
        assert!(is_virtual_file_system("overlay"));
        assert!(is_virtual_file_system("composefs"));
        assert!(is_virtual_file_system("tmpfs"));
        assert!(!is_virtual_file_system("btrfs"));
        assert!(!is_virtual_file_system("ext4"));
        assert!(!is_virtual_file_system("ntfs"));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn prioritizes_persistent_linux_storage() {
        assert!(disk_priority("/") < disk_priority("/var/home"));
        assert!(disk_priority("/var/home") < disk_priority("/var"));
        assert!(disk_priority("/var") < disk_priority("/boot"));
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
