use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KryptonPathsInfo {
    pub home: String,
    pub worktrees: String,
    pub cache: String,
    pub logs: String,
    pub agents: String,
    pub tools: String,
    pub browser_profiles: String,
    pub exists: bool,
    pub writable: bool,
}

/// Resolves the OS-native root configuration directory for Krypton (`~/.krypton`).
pub fn get_krypton_home() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            return PathBuf::from(user_profile).join(".krypton");
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".krypton");
    }

    PathBuf::from(".krypton")
}

/// Verifies and scaffolds the standard ~/.krypton directory tree.
pub fn ensure_krypton_directories() -> Result<KryptonPathsInfo, String> {
    let home = get_krypton_home();

    let subdirs = [
        "cache/outputs",
        "pty_sessions",
        "telemetry",
        "agents",
        "worktrees",
        "tools/python",
        "tools/typescript",
        "browser_profiles/default",
        "logs",
    ];

    if !home.exists() {
        fs::create_dir_all(&home)
            .map_err(|e| format!("Failed to create Krypton home {:?}: {}", home, e))?;
    }

    for sub in &subdirs {
        let dir = home.join(sub);
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create directory {:?}: {}", dir, e))?;
        }
    }

    // Check write permissions by writing and deleting a temporary probe file
    let probe_path = home.join(".write_test");
    let writable = match fs::write(&probe_path, b"probe") {
        Ok(_) => {
            let _ = fs::remove_file(probe_path);
            true
        }
        Err(_) => false,
    };

    Ok(KryptonPathsInfo {
        home: home.to_string_lossy().to_string(),
        worktrees: home.join("worktrees").to_string_lossy().to_string(),
        cache: home.join("cache").to_string_lossy().to_string(),
        logs: home.join("logs").to_string_lossy().to_string(),
        agents: home.join("agents").to_string_lossy().to_string(),
        tools: home.join("tools").to_string_lossy().to_string(),
        browser_profiles: home.join("browser_profiles").to_string_lossy().to_string(),
        exists: home.exists(),
        writable,
    })
}

#[tauri::command]
pub fn get_krypton_paths() -> Result<KryptonPathsInfo, String> {
    ensure_krypton_directories()
}
