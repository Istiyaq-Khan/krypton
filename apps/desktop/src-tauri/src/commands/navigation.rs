use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationRoutePayload {
    pub route: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tab: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<HashMap<String, String>>,
    pub timestamp: u64,
}

#[tauri::command]
pub async fn navigate_to_route(
    app: AppHandle,
    route: String,
    tab: Option<String>,
    params: Option<HashMap<String, String>>,
) -> Result<bool, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let payload = NavigationRoutePayload {
        route,
        tab,
        params,
        timestamp: now,
    };

    app.emit("navigation:go-to-route", payload)
        .map_err(|e| e.to_string())?;

    Ok(true)
}
