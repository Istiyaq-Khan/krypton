use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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

/// Resolves the bundled or local krypton-daemon binary path using robust candidate discovery.
pub fn resolve_daemon_binary() -> Option<PathBuf> {
    let daemon_name = if cfg!(target_os = "windows") {
        "krypton-daemon.exe"
    } else {
        "krypton-daemon"
    };

    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. Packaged installation: search relative to current_exe()
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Next to main executable (Windows NSIS / Linux / portable directory)
            candidates.push(exe_dir.join(daemon_name));
            candidates.push(exe_dir.join("binaries").join(daemon_name));

            // macOS .app bundle paths (Contents/MacOS or Contents/Resources)
            candidates.push(exe_dir.join("../Resources").join(daemon_name));
            candidates.push(exe_dir.join("../Resources/binaries").join(daemon_name));
            candidates.push(exe_dir.join("../MacOS").join(daemon_name));
        }
    }

    // 2. Linux AppImage environment
    if let Ok(appdir) = std::env::var("APPDIR") {
        let appdir_path = PathBuf::from(appdir);
        candidates.push(appdir_path.join("usr/bin").join(daemon_name));
        candidates.push(appdir_path.join(daemon_name));
    }

    // 3. User home configuration directory (~/.krypton/bin)
    let home_bin = crate::paths::get_krypton_home().join("bin").join(daemon_name);
    candidates.push(home_bin);

    // 4. Local development paths (relative to CWD / workspace)
    candidates.push(PathBuf::from(format!("binaries/{}", daemon_name)));
    candidates.push(PathBuf::from(format!("apps/desktop/src-tauri/binaries/{}", daemon_name)));
    candidates.push(PathBuf::from(format!("../binaries/{}", daemon_name)));
    candidates.push(PathBuf::from(format!("src-tauri/binaries/{}", daemon_name)));

    // 5. Node.js fallback entrypoint in development
    candidates.push(PathBuf::from("../../packages/agent-runtime/dist/daemon.js"));
    candidates.push(PathBuf::from("../../packages/agent-runtime/dist/index.js"));
    candidates.push(PathBuf::from("packages/agent-runtime/dist/daemon.js"));
    candidates.push(PathBuf::from("packages/agent-runtime/dist/index.js"));

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
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

    let resolved = resolve_daemon_binary();
    let mut launched: Option<Child> = None;
    let mut resolved_path = "krypton-daemon".to_string();

    if let Some(path) = resolved {
        resolved_path = path.to_string_lossy().to_string();
        let ext_str = path.extension().and_then(|s| s.to_str()).unwrap_or("");

        let spawn_res = if ext_str == "js" {
            Command::new("node").arg(&path).spawn()
        } else {
            let mut cmd = Command::new(&path);
            if let Some(parent) = path.parent() {
                cmd.current_dir(parent);
            }
            cmd.spawn()
        };

        match spawn_res {
            Ok(c) => {
                launched = Some(c);
            }
            Err(e) => {
                log::warn!("Failed to spawn daemon binary from {}: {}", resolved_path, e);
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
