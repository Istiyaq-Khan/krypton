use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyConfig {
    pub hotkey: String,
    pub enabled: bool,
}

static HOTKEY_CONFIG: std::sync::OnceLock<Arc<Mutex<HotkeyConfig>>> = std::sync::OnceLock::new();

fn get_hotkey_state() -> &'static Arc<Mutex<HotkeyConfig>> {
    HOTKEY_CONFIG.get_or_init(|| {
        Arc::new(Mutex::new(HotkeyConfig {
            hotkey: "CommandOrControl+Shift+Space".to_string(),
            enabled: true,
        }))
    })
}

/// Retrieves the configured global shortcut string.
#[tauri::command]
pub fn get_global_hotkey() -> Result<HotkeyConfig, String> {
    let state = get_hotkey_state();
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

/// Updates the configured global shortcut string.
#[tauri::command]
pub fn set_global_hotkey(hotkey: String, enabled: bool) -> Result<HotkeyConfig, String> {
    let state = get_hotkey_state();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.hotkey = hotkey;
    guard.enabled = enabled;
    Ok(guard.clone())
}

/// Invoked when the global hotkey is triggered to toggle the overlay.
#[tauri::command]
pub fn trigger_hotkey_overlay(app: AppHandle) -> Result<bool, String> {
    crate::overlay::toggle_overlay(app)
}
