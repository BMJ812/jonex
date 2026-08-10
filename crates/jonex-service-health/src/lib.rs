use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use jonex_service_registry::{ServiceKind, ServiceRecord};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServiceHealthStatus {
    Online,
    AuthRequired,
    Offline,
    Fault,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceProbeResult {
    pub service_id: String,
    pub status: ServiceHealthStatus,
    pub probe_url: String,
    pub http_status: Option<u16>,
    pub latency_ms: u64,
    pub checked_at_unix_ms: u64,
    pub detail: String,
}

pub async fn probe_service(service: &ServiceRecord) -> ServiceProbeResult {
    let probe_url = probe_url(service);
    let started = Instant::now();

    if !service.enabled {
        return result(
            service,
            ServiceHealthStatus::Fault,
            probe_url,
            None,
            started,
            "service is disabled".to_owned(),
        );
    }

    let client = match Client::builder()
        .timeout(PROBE_TIMEOUT)
        .no_proxy()
        .user_agent(format!("JONEX/{}", env!("CARGO_PKG_VERSION")))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            return result(
                service,
                ServiceHealthStatus::Fault,
                probe_url,
                None,
                started,
                format!("failed to initialize HTTP client: {error}"),
            );
        }
    };

    match client.get(&probe_url).send().await {
        Ok(response) => {
            let status = response.status();
            let http_status = Some(status.as_u16());

            if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
                return result(
                    service,
                    ServiceHealthStatus::AuthRequired,
                    probe_url,
                    http_status,
                    started,
                    format!("HTTP {} requires authentication", status.as_u16()),
                );
            }

            if status.is_success() || status.is_redirection() {
                return result(
                    service,
                    ServiceHealthStatus::Online,
                    probe_url,
                    http_status,
                    started,
                    format!("HTTP {} responded", status.as_u16()),
                );
            }

            result(
                service,
                ServiceHealthStatus::Fault,
                probe_url,
                http_status,
                started,
                format!("HTTP {} returned an error response", status.as_u16()),
            )
        }
        Err(error) => {
            let detail = if error.is_timeout() {
                format!("probe timed out after {} seconds", PROBE_TIMEOUT.as_secs())
            } else if error.is_connect() {
                format!("connection failed: {error}")
            } else {
                format!("request failed: {error}")
            };

            result(
                service,
                ServiceHealthStatus::Offline,
                probe_url,
                None,
                started,
                detail,
            )
        }
    }
}

fn probe_url(service: &ServiceRecord) -> String {
    let base = service.base_url.trim_end_matches('/');

    match service.kind {
        ServiceKind::HomeAssistant => format!("{base}/api/"),
        _ => format!("{base}/"),
    }
}

fn result(
    service: &ServiceRecord,
    status: ServiceHealthStatus,
    probe_url: String,
    http_status: Option<u16>,
    started: Instant,
    detail: String,
) -> ServiceProbeResult {
    ServiceProbeResult {
        service_id: service.id.clone(),
        status,
        probe_url,
        http_status,
        latency_ms: started.elapsed().as_millis().try_into().unwrap_or(u64::MAX),
        checked_at_unix_ms: unix_time_ms(),
        detail,
    }
}

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn service(kind: ServiceKind, base_url: &str) -> ServiceRecord {
        ServiceRecord {
            id: "service-test".to_owned(),
            kind,
            name: "Service Test".to_owned(),
            base_url: base_url.to_owned(),
            enabled: true,
        }
    }

    #[test]
    fn home_assistant_uses_api_health_endpoint() {
        let service = service(ServiceKind::HomeAssistant, "http://192.168.0.15:8123/");
        assert_eq!(probe_url(&service), "http://192.168.0.15:8123/api/");
    }

    #[test]
    fn generic_services_probe_the_registered_root() {
        let service = service(ServiceKind::Generic, "https://example.test/base");
        assert_eq!(probe_url(&service), "https://example.test/base/");
    }
}
