use tauri::{AppHandle, Manager};

/// Toggles the visibility of the Voice Micro-HUD overlay window.
#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let is_visible = window.is_visible().map_err(|e| e.to_string())?;
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            let _ = window.center();
            window.show().map_err(|e| e.to_string())?;
            let _ = window.set_focus();
            Ok(true)
        }
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Shows and focuses the Voice Micro-HUD overlay.
#[tauri::command]
pub fn show_overlay(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.center();
        window.show().map_err(|e| e.to_string())?;
        let _ = window.set_focus();
        Ok(true)
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Hides the Voice Micro-HUD overlay.
#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.hide().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Positions the overlay window in the center of the display.
#[tauri::command]
pub fn center_overlay(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.center().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Sets click-through (ignore cursor events) on the overlay window when idle.
#[tauri::command]
pub fn set_overlay_clickthrough(app: AppHandle, ignore: bool) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
        Ok(ignore)
    } else {
        Err("Overlay window not found".to_string())
    }
}
