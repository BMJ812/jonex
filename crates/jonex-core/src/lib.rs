use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub app_version: &'static str,
    pub target_os: &'static str,
    pub target_arch: &'static str,
    pub debug_build: bool,
}

#[must_use]
pub const fn platform_info() -> PlatformInfo {
    PlatformInfo {
        app_version: env!("CARGO_PKG_VERSION"),
        target_os: std::env::consts::OS,
        target_arch: std::env::consts::ARCH,
        debug_build: cfg!(debug_assertions),
    }
}

#[cfg(test)]
mod tests {
    use super::platform_info;

    #[test]
    fn platform_information_contains_build_target() {
        let info = platform_info();

        assert!(!info.app_version.is_empty());
        assert!(!info.target_os.is_empty());
        assert!(!info.target_arch.is_empty());
    }
}
