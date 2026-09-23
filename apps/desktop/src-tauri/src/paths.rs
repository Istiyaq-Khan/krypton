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
    pub models: String,
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
        "models",
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

    // Seed default system.md and agents/root.md if missing
    let system_md = home.join("system.md");
    if !system_md.exists() {
        let default_sys = "# Krypton Autonomous Operating System — Root Directives\n\nYou are Krypton, an autonomous desktop operating system and intelligent agent runtime.\n\n## Core Operational Principles\n1. **Safety & Invariants**: Always verify AST constraints and execute hazardous operations in isolated environments.\n2. **Deterministic & Atomic Execution**: Perform operations atomically. When mutating files, ensure writes are verified before concluding tasks.\n3. **No Direct Branch Pollution**: Autonomous tasks execute within isolated worktrees (~/.krypton/worktrees/<task-id>).\n4. **Multi-Tier Verification**: Verify all modifications with typechecks, unit tests, and runtime validation before reporting completion.\n5. **Self-Updating Memory**: Maintain long-term system memory and operational directives via file-driven markdown instructions in ~/.krypton/.\n";
        let _ = fs::write(system_md, default_sys);
    }

    let root_md = home.join("agents").join("root.md");
    if !root_md.exists() {
        let default_root = "# Root Supervisor Agent — Profile & Scope\n\n## Identity & Role\nYou are the Root Supervisor Agent for the Krypton ecosystem. Your purpose is to orchestrate tasks, coordinate sub-agents, and maintain operational coherence across the user's projects.\n\n## Reasoning Tone & Behavior\n- **Objective & Analytical**: Prioritize correctness, verification, and concise communication.\n- **Autonomous & Agile**: Execute end-to-end task plans without requiring manual micro-management, pausing only for critical human-in-the-loop approvals.\n- **Transparent Execution**: Report progress with clear milestone indicators and concise summaries.\n\n## Tooling & Directives\n- Use system instruction tools (`read_system_instructions`, `update_system_instructions`) to inspect or update your directives and maintain persistent operational memory across sessions.\n";
        let _ = fs::write(root_md, default_root);
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
        models: home.join("models").to_string_lossy().to_string(),
        exists: home.exists(),
        writable,
    })
}

#[tauri::command]
pub fn get_krypton_paths() -> Result<KryptonPathsInfo, String> {
    ensure_krypton_directories()
}
