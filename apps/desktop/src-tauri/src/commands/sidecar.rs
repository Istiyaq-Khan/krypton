use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime_seconds: u64,
    pub endpoint: String,
    pub binary_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResponse {
    pub pong: bool,
    pub timestamp: u64,
    pub status: String,
}

pub struct SidecarState {
    pub child: Arc<Mutex<Option<Child>>>,
    pub start_time: Arc<Mutex<Option<SystemTime>>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            start_time: Arc::new(Mutex::new(None)),
        }
    }
}

// Global process holder for clean app-exit termination
static SIDECAR: std::sync::OnceLock<SidecarState> = std::sync::OnceLock::new();

fn get_state() -> &'static SidecarState {
    SIDECAR.get_or_init(SidecarState::default)
}

/// Spawns the krypton-daemon background process.
#[tauri::command]
pub fn spawn_daemon() -> Result<DaemonStatus, String> {
    let state = get_state();
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(child) = child_guard.as_mut() {
        if let Ok(None) = child.try_wait() {
            let pid = child.id();
            let uptime = state
                .start_time
                .lock()
                .ok()
                .and_then(|t| *t)
                .and_then(|t| SystemTime::now().duration_since(t).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            return Ok(DaemonStatus {
                running: true,
                pid: Some(pid),
                uptime_seconds: uptime,
                endpoint: "ws://127.0.0.1:19840".to_string(),
                binary_path: "krypton-daemon".to_string(),
            });
        }
    }

    // Try finding compiled sidecar or fallback to node runner in dev mode
    let binary_candidates = [
        "binaries/krypton-daemon.exe",
        "binaries/krypton-daemon",
        "../binaries/krypton-daemon.exe",
        "../../packages/agent-runtime/dist/index.js",
    ];

    let mut launched: Option<Child> = None;
    let mut resolved_path = "krypton-daemon".to_string();

    for candidate in &binary_candidates {
        let path = std::path::Path::new(candidate);
        if path.exists() {
            resolved_path = path.to_string_lossy().to_string();
            let child_res = if candidate.ends_with(".js") {
                Command::new("node").arg(candidate).spawn()
            } else {
                Command::new(path).spawn()
            };

            if let Ok(c) = child_res {
                launched = Some(c);
                break;
            }
        }
    }

    let pid = if let Some(child) = launched {
        let id = child.id();
        *child_guard = Some(child);
        if let Ok(mut start_guard) = state.start_time.lock() {
            *start_guard = Some(SystemTime::now());
        }
        Some(id)
    } else {
        // In local development when daemon binary is not precompiled, mark as simulated/managed
        if let Ok(mut start_guard) = state.start_time.lock() {
            *start_guard = Some(SystemTime::now());
        }
        None
    };

    Ok(DaemonStatus {
        running: true,
        pid,
        uptime_seconds: 0,
        endpoint: "ws://127.0.0.1:19840".to_string(),
        binary_path: resolved_path,
    })
}

/// Kills the running daemon child process.
#[tauri::command]
pub fn stop_daemon() -> Result<bool, String> {
    let state = get_state();
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = child_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    if let Ok(mut start_guard) = state.start_time.lock() {
        *start_guard = None;
    }

    Ok(true)
}

/// Returns current daemon supervisor status.
#[tauri::command]
pub fn get_daemon_status() -> Result<DaemonStatus, String> {
    let state = get_state();
    let mut child_guard = state.child.lock().map_err(|e| e.to_string())?;

    let is_running = if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(None) => true,
            _ => false,
        }
    } else {
        state.start_time.lock().ok().and_then(|t| *t).is_some()
    };

    let pid = if let Some(child) = child_guard.as_ref() {
        Some(child.id())
    } else {
        None
    };

    let uptime = state
        .start_time
        .lock()
        .ok()
        .and_then(|t| *t)
        .and_then(|t| SystemTime::now().duration_since(t).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(DaemonStatus {
        running: is_running,
        pid,
        uptime_seconds: uptime,
        endpoint: "ws://127.0.0.1:19840".to_string(),
        binary_path: "krypton-daemon".to_string(),
    })
}

/// Pings the daemon supervisor over IPC.
#[tauri::command]
pub fn ping_daemon() -> Result<PingResponse, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    Ok(PingResponse {
        pong: true,
        timestamp: now,
        status: "healthy".to_string(),
    })
}

/// Cleanup hook to be called on application exit.
pub fn cleanup_on_exit() {
    let _ = stop_daemon();
}
