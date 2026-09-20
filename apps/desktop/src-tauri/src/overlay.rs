use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Resolves either the newly branded "synapse" window or fallback "overlay" window.
fn get_synapse_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("synapse")
        .or_else(|| app.get_webview_window("overlay"))
}

/// Toggles the visibility of the frameless, transparent Krypton Synapse window.
#[tauri::command]
pub fn toggle_synapse(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = get_synapse_window(&app) {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            let _ = app.emit("synapse:toggle", false);
            Ok(false)
        } else {
            let _ = window.center();
            window.show().map_err(|e| e.to_string())?;
            let _ = window.set_focus();
            let _ = app.emit("synapse:toggle", true);
            Ok(true)
        }
    } else {
        Err("Synapse window not found".to_string())
    }
}

/// Shows and focuses the Krypton Synapse window.
#[tauri::command]
pub fn show_synapse(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = get_synapse_window(&app) {
        let _ = window.center();
        window.show().map_err(|e| e.to_string())?;
        let _ = window.set_focus();
        let _ = app.emit("synapse:toggle", true);
        Ok(true)
    } else {
        Err("Synapse window not found".to_string())
    }
}

/// Hides the Krypton Synapse window.
#[tauri::command]
pub fn hide_synapse(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = get_synapse_window(&app) {
        window.hide().map_err(|e| e.to_string())?;
        let _ = app.emit("synapse:toggle", false);
        Ok(false)
    } else {
        Err("Synapse window not found".to_string())
    }
}

/// Positions the Synapse window in the center of the display.
#[tauri::command]
pub fn center_synapse(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = get_synapse_window(&app) {
        window.center().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Err("Synapse window not found".to_string())
    }
}

/// Sets click-through (ignore cursor events) on the Synapse window when idle.
#[tauri::command]
pub fn set_synapse_clickthrough(app: AppHandle, ignore: bool) -> Result<bool, String> {
    if let Some(window) = get_synapse_window(&app) {
        window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
        Ok(ignore)
    } else {
        Err("Synapse window not found".to_string())
    }
}

// ============================================================================
// Legacy Aliases for Seamless Backward Compatibility
// ============================================================================

#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> Result<bool, String> {
    toggle_synapse(app)
}

#[tauri::command]
pub fn show_overlay(app: AppHandle) -> Result<bool, String> {
    show_synapse(app)
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<bool, String> {
    hide_synapse(app)
}

#[tauri::command]
pub fn center_overlay(app: AppHandle) -> Result<bool, String> {
    center_synapse(app)
}

#[tauri::command]
pub fn set_overlay_clickthrough(app: AppHandle, ignore: bool) -> Result<bool, String> {
    set_synapse_clickthrough(app, ignore)
}
