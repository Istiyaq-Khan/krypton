use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::paths::{ensure_krypton_directories, get_krypton_home};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SetupApiKeys {
    pub anthropic: Option<String>,
    pub openai: Option<String>,
    pub custom_endpoint: Option<String>,
    pub custom_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupConfigPayload {
    pub agent_name: String,
    pub agent_role: Option<String>,
    pub primary_model: Option<String>,
    pub api_keys: Option<SetupApiKeys>,
    pub default_workspace_dir: Option<String>,
    pub ask_for_approval: Option<bool>,
    pub ast_safety_enforced: Option<bool>,
    pub telemetry_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatusResult {
    pub is_initialized: bool,
    pub custom_agent_name: String,
    pub primary_model: String,
    pub default_workspace_dir: String,
    pub ask_for_approval: bool,
    pub config_path: String,
}

fn resolve_default_workspace() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let p = PathBuf::from(user_profile).join("Projects");
            return p.to_string_lossy().to_string();
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join("projects");
        return p.to_string_lossy().to_string();
    }

    "projects".to_string()
}

/// Checks whether Krypton has been initialized on the host machine.
#[tauri::command]
pub fn check_setup_status() -> Result<SetupStatusResult, String> {
    let home = get_krypton_home();
    let config_path = home.join("config.json");
    let default_ws = resolve_default_workspace();

    if !config_path.exists() {
        return Ok(SetupStatusResult {
            is_initialized: false,
            custom_agent_name: "Orchestrator".to_string(),
            primary_model: "5.6 Terra High".to_string(),
            default_workspace_dir: default_ws,
            ask_for_approval: true,
            config_path: config_path.to_string_lossy().to_string(),
        });
    }

    let raw = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config {:?}: {}", config_path, e))?;

    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .unwrap_or(serde_json::json!({}));

    let is_init = parsed.get("isInitialized")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let agent_name = parsed.get("customAgentName")
        .and_then(|v| v.as_str())
        .unwrap_or("Orchestrator")
        .to_string();

    let default_ws_dir = parsed.get("defaultWorkspaceDir")
        .and_then(|v| v.as_str())
        .unwrap_or(&default_ws)
        .to_string();

    let ask_approval = parsed.get("askForApproval")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let primary_model = parsed.get("defaultRoutes")
        .and_then(|r| r.get("orchestrator"))
        .and_then(|o| o.get("model"))
        .and_then(|m| m.as_str())
        .unwrap_or("5.6 Terra High")
        .to_string();

    Ok(SetupStatusResult {
        is_initialized: is_init,
        custom_agent_name: agent_name,
        primary_model,
        default_workspace_dir: default_ws_dir,
        ask_for_approval: ask_approval,
        config_path: config_path.to_string_lossy().to_string(),
    })
}

/// Validates and saves setup configuration to ~/.krypton/config.json and sets up initial agent workspace.
#[tauri::command]
pub fn save_setup_configuration(payload: SetupConfigPayload) -> Result<bool, String> {
    ensure_krypton_directories()?;
    let home = get_krypton_home();
    let config_path = home.join("config.json");

    let mut config: serde_json::Value = if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let agent_name = if payload.agent_name.trim().is_empty() {
        "Orchestrator".to_string()
    } else {
        payload.agent_name.trim().to_string()
    };

    let primary_model = payload.primary_model
        .clone()
        .unwrap_or_else(|| "5.6 Terra High".to_string());

    let ws_dir = payload.default_workspace_dir
        .clone()
        .unwrap_or_else(resolve_default_workspace);

    config["version"] = serde_json::json!("1.0.0");
    config["isInitialized"] = serde_json::json!(true);
    config["customAgentName"] = serde_json::json!(&agent_name);
    config["defaultWorkspaceDir"] = serde_json::json!(&ws_dir);
    config["askForApproval"] = serde_json::json!(payload.ask_for_approval.unwrap_or(true));

    if let Some(telemetry) = payload.telemetry_enabled {
        config["telemetry"] = serde_json::json!({
            "enabled": telemetry,
            "logLevel": "info"
        });
    }

    // Update default route model
    if let Some(routes) = config.get_mut("defaultRoutes") {
        if let Some(orch) = routes.get_mut("orchestrator") {
            orch["model"] = serde_json::json!(&primary_model);
        }
    } else {
        config["defaultRoutes"] = serde_json::json!({
            "orchestrator": {
                "provider": "anthropic",
                "model": &primary_model
            }
        });
    }

    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialization error: {}", e))?;

    fs::write(&config_path, serialized)
        .map_err(|e| format!("Failed to write config {:?}: {}", config_path, e))?;

    // Scaffold initial agent workspace in ~/.krypton/agents/<agent_name>
    let agent_dir = home.join("agents").join(&agent_name);
    let _ = fs::create_dir_all(agent_dir.join("short_term").join("trajectories"));

    let role_desc = payload.agent_role
        .unwrap_or_else(|| "System Orchestrator & Autonomous Desktop Agent".to_string());

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let agent_id = format!("agent-{}", agent_name.to_lowercase().replace(' ', "_"));
    let agent_config = serde_json::json!({
        "id": agent_id,
        "name": agent_name,
        "role": role_desc,
        "model": primary_model,
        "provider": "anthropic",
        "temperature": 0.2,
        "contextWindowLimit": 128_000,
        "tools": ["terminal", "filesystem", "astLinter", "web"],
        "permissions": {
            "allowedSubAgents": ["CoderBot", "TesterBot"],
            "allowedTools": ["terminal", "filesystem", "astLinter", "web"],
            "maxDepth": 3,
            "maxConcurrentChildren": 5,
            "budgetShare": 0.5,
            "canSynthesizeTools": true,
            "canAccessNetwork": true,
            "canModifyWorkspace": true,
            "terminal": true,
            "filesystem": true,
            "web": true,
            "astLinter": true
        },
        "budget": {
            "total": 100_000,
            "used": 0
        },
        "createdAt": now,
        "updatedAt": now,
        "metadata": {}
    });

    let serialized_agent_cfg = serde_json::to_string_pretty(&agent_config).unwrap_or_default();
    let _ = fs::write(agent_dir.join("config.json"), serialized_agent_cfg);

    let id_content = format!(
        "# Agent Identity: {}\n\nAutonomous agent initialized via First-Run Setup Engine.\nDirects tasks, coordinates sub-agents, and maintains project coherence.\n",
        agent_name
    );
    let _ = fs::write(agent_dir.join("IDENTITY.md"), id_content);

    let soul_content = "# Core Directives & Behavioral Guardrails\n\nOperate with zero server lock-in and verify all AST boundaries before execution.\nMaintain an objective, analytical, and concise demeanor.\nPrioritize verification and correctness over speculative changes.\n";
    let _ = fs::write(agent_dir.join("SOUL.md"), soul_content);

    let agents_manifest = "# Sub-Agent Delegation & Workspace Conventions\n\nHierarchical delegation boundaries apply to all sub-agent dispatches.\nEnsure all spawned children are bounded by execution timeouts and token limits.\n";
    let _ = fs::write(agent_dir.join("AGENTS.md"), agents_manifest);

    let user_prefs = "# User Preferences & Directives\n\nLocal user preferences and domain guidelines.\n- Prefer concise progress updates during autonomous execution.\n";
    let _ = fs::write(agent_dir.join("USER.md"), user_prefs);

    // If API keys provided, store in ~/.krypton/credentials.json as clean local store
    if let Some(keys) = payload.api_keys {
        let creds_path = home.join("credentials.json");
        let mut creds_map = serde_json::Map::new();
        if let Some(ref k) = keys.anthropic {
            if !k.trim().is_empty() {
                creds_map.insert("anthropic_api_key".to_string(), serde_json::json!(k.trim()));
            }
        }
        if let Some(ref k) = keys.openai {
            if !k.trim().is_empty() {
                creds_map.insert("openai_api_key".to_string(), serde_json::json!(k.trim()));
            }
        }
        if let Some(ref ep) = keys.custom_endpoint {
            if !ep.trim().is_empty() {
                creds_map.insert("custom_endpoint".to_string(), serde_json::json!(ep.trim()));
            }
        }
        if let Some(ref m) = keys.custom_model {
            if !m.trim().is_empty() {
                creds_map.insert("custom_model".to_string(), serde_json::json!(m.trim()));
            }
        }

        if !creds_map.is_empty() {
            let _ = fs::write(&creds_path, serde_json::to_string_pretty(&creds_map).unwrap_or_default());
        }
    }

    Ok(true)
}
