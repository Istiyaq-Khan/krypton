use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use crate::paths::{ensure_krypton_directories, get_krypton_home};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredModelItem {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub context_length: Option<u64>,
    pub supports_temperature: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CachedModelsData {
    pub provider: String,
    pub base_url: Option<String>,
    pub models: Vec<DiscoveredModelItem>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigData {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SetupApiKeys {
    pub provider: Option<String>,
    pub anthropic: Option<String>,
    pub openai: Option<String>,
    pub openrouter: Option<String>,
    pub custom_endpoint: Option<String>,
    pub custom_model: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupConfigPayload {
    pub agent_name: String,
    pub agent_role: Option<String>,
    pub provider: Option<String>,
    pub primary_model: Option<String>,
    pub api_keys: Option<SetupApiKeys>,
    pub cached_models: Option<Vec<DiscoveredModelItem>>,
    pub default_workspace_dir: Option<String>,
    pub ask_for_approval: Option<bool>,
    pub ast_safety_enforced: Option<bool>,
    pub telemetry_enabled: Option<bool>,
    pub vtt_engine: Option<String>,
    pub vtt_custom_endpoint: Option<String>,
    pub vtt_api_key: Option<String>,
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

    let chosen_provider = payload.provider
        .as_deref()
        .filter(|p| !p.trim().is_empty())
        .or_else(|| {
            payload.api_keys.as_ref().and_then(|k| k.provider.as_deref())
        })
        .unwrap_or("openai")
        .to_lowercase();

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

    let vtt_engine = payload.vtt_engine.unwrap_or_else(|| "whisper_local".to_string());
    let vtt_architecture = match vtt_engine.as_str() {
        "nvidia/parakeet-tdt-0.6b-v3" => "conformer_rnnt_tdt",
        "whisper_api" => "cloud_api",
        "custom" => "custom",
        _ => "encoder_decoder_autoregressive",
    };
    let mut vtt_obj = serde_json::json!({
        "engine": &vtt_engine,
        "architecture": vtt_architecture,
        "sampleRate": 16000
    });
    if let Some(endpoint) = payload.vtt_custom_endpoint.as_ref().filter(|s| !s.trim().is_empty()) {
        vtt_obj["customEndpoint"] = serde_json::json!(endpoint.trim());
    }
    if let Some(key) = payload.vtt_api_key.as_ref().filter(|s| !s.trim().is_empty()) {
        vtt_obj["apiKey"] = serde_json::json!(key.trim());
    }
    config["vtt"] = vtt_obj;

    // Update default route provider & model dynamically without hardcoding
    if let Some(routes) = config.get_mut("defaultRoutes") {
        if let Some(orch) = routes.get_mut("orchestrator") {
            orch["provider"] = serde_json::json!(&chosen_provider);
            orch["model"] = serde_json::json!(&primary_model);
        }
    } else {
        config["defaultRoutes"] = serde_json::json!({
            "orchestrator": {
                "provider": &chosen_provider,
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
        "provider": &chosen_provider,
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

    // If API keys / endpoints provided, store in ~/.krypton/credentials.json without hardcoding
    if let Some(ref keys) = payload.api_keys {
        let creds_path = home.join("credentials.json");
        let mut creds_map: serde_json::Map<String, serde_json::Value> = if creds_path.exists() {
            fs::read_to_string(&creds_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            serde_json::Map::new()
        };

        creds_map.insert("active_provider".to_string(), serde_json::json!(&chosen_provider));

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
        if let Some(ref k) = keys.openrouter {
            if !k.trim().is_empty() {
                creds_map.insert("openrouter_api_key".to_string(), serde_json::json!(k.trim()));
            }
        }
        if let Some(ref ep) = keys.custom_endpoint {
            if !ep.trim().is_empty() {
                creds_map.insert("custom_endpoint".to_string(), serde_json::json!(ep.trim()));
                creds_map.insert(format!("{}_base_url", chosen_provider), serde_json::json!(ep.trim()));
            }
        }
        if let Some(ref m) = keys.custom_model {
            if !m.trim().is_empty() {
                creds_map.insert("custom_model".to_string(), serde_json::json!(m.trim()));
            }
        }
        if let Some(ref bu) = keys.base_url {
            if !bu.trim().is_empty() {
                creds_map.insert(format!("{}_base_url", chosen_provider), serde_json::json!(bu.trim()));
            }
        }
        if let Some(ref ak) = keys.api_key {
            if !ak.trim().is_empty() {
                creds_map.insert(format!("{}_api_key", chosen_provider), serde_json::json!(ak.trim()));
            }
        }

        if !creds_map.is_empty() {
            let _ = fs::write(&creds_path, serde_json::to_string_pretty(&creds_map).unwrap_or_default());
        }
    }

    // If cached models provided, write to ~/.krypton/models_cache.json
    if let Some(models) = payload.cached_models {
        let cache_path = home.join("models_cache.json");
        let base_url = payload.api_keys.as_ref().and_then(|k| k.base_url.clone().or_else(|| k.custom_endpoint.clone()));
        let cache_data = CachedModelsData {
            provider: chosen_provider.clone(),
            base_url,
            models,
            updated_at: now,
        };
        let _ = fs::write(&cache_path, serde_json::to_string_pretty(&cache_data).unwrap_or_default());
    }

    Ok(true)
}

/// Reads cached models from ~/.krypton/models_cache.json
#[tauri::command]
pub fn get_cached_models() -> Result<CachedModelsData, String> {
    let home = get_krypton_home();
    let cache_path = home.join("models_cache.json");
    if !cache_path.exists() {
        return Ok(CachedModelsData::default());
    }
    let raw = fs::read_to_string(&cache_path)
        .map_err(|e| format!("Failed to read models cache: {}", e))?;
    let parsed: CachedModelsData = serde_json::from_str(&raw)
        .unwrap_or_default();
    Ok(parsed)
}

/// Saves cached models to ~/.krypton/models_cache.json
#[tauri::command]
pub fn save_cached_models(payload: CachedModelsData) -> Result<bool, String> {
    ensure_krypton_directories()?;
    let home = get_krypton_home();
    let cache_path = home.join("models_cache.json");
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Failed to serialize model cache: {}", e))?;
    fs::write(&cache_path, serialized)
        .map_err(|e| format!("Failed to write model cache: {}", e))?;
    Ok(true)
}

/// Retrieves active provider and endpoint metadata for in-app model refresh
#[tauri::command]
pub fn get_provider_config() -> Result<ProviderConfigData, String> {
    let home = get_krypton_home();
    let config_path = home.join("config.json");
    let creds_path = home.join("credentials.json");

    let mut provider = "openai".to_string();
    let mut model = "5.6 Terra High".to_string();
    let mut base_url = None;
    let mut api_key = None;

    if config_path.exists() {
        if let Ok(raw) = fs::read_to_string(&config_path) {
            if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(orch) = cfg.get("defaultRoutes").and_then(|r| r.get("orchestrator")) {
                    if let Some(p) = orch.get("provider").and_then(|v| v.as_str()) {
                        provider = p.to_string();
                    }
                    if let Some(m) = orch.get("model").and_then(|v| v.as_str()) {
                        model = m.to_string();
                    }
                }
            }
        }
    }

    if creds_path.exists() {
        if let Ok(raw) = fs::read_to_string(&creds_path) {
            if let Ok(creds) = serde_json::from_str::<serde_json::Value>(&raw) {
                let prov_lower = provider.to_lowercase();
                let key_name = format!("{}_api_key", prov_lower);
                let url_name = format!("{}_base_url", prov_lower);

                if let Some(k) = creds.get(&key_name).or_else(|| creds.get("api_key")).and_then(|v| v.as_str()) {
                    api_key = Some(k.to_string());
                }
                if let Some(u) = creds.get(&url_name).or_else(|| creds.get("custom_endpoint")).and_then(|v| v.as_str()) {
                    base_url = Some(u.to_string());
                }
            }
        }
    }

    Ok(ProviderConfigData {
        provider,
        model,
        base_url,
        api_key,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderKeySetting {
    pub provider: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub custom_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsPayload {
    pub default_workspace_dir: Option<String>,
    pub default_terminal_shell: Option<String>,
    pub ask_for_approval: Option<bool>,
    pub ast_safety_enforced: Option<bool>,
    pub telemetry_enabled: Option<bool>,
    pub active_provider: Option<String>,
    pub theme: Option<String>,
    pub font_size: Option<String>,
    pub ui_density: Option<String>,
    pub providers: Option<Vec<ProviderKeySetting>>,
    pub vtt_engine: Option<String>,
    pub vtt_custom_endpoint: Option<String>,
    pub vtt_api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsResult {
    pub default_workspace_dir: String,
    pub default_terminal_shell: String,
    pub ask_for_approval: bool,
    pub ast_safety_enforced: bool,
    pub telemetry_enabled: bool,
    pub active_provider: String,
    pub theme: String,
    pub font_size: String,
    pub ui_density: String,
    pub providers: Vec<ProviderKeySetting>,
    pub vtt_engine: String,
    pub vtt_custom_endpoint: Option<String>,
    pub vtt_api_key: Option<String>,
}

/// Retrieves all global settings and provider credentials
#[tauri::command]
pub fn get_app_settings() -> Result<AppSettingsResult, String> {
    let home = get_krypton_home();
    let config_path = home.join("config.json");
    let creds_path = home.join("credentials.json");
    let default_ws = resolve_default_workspace();

    let mut default_workspace_dir = default_ws;
    let mut default_terminal_shell = "system".to_string();
    let mut ask_for_approval = true;
    let mut ast_safety_enforced = true;
    let mut telemetry_enabled = false;
    let mut active_provider = "openai".to_string();
    let mut theme = "dark".to_string();
    let mut font_size = "standard".to_string();
    let mut ui_density = "comfortable".to_string();
    let mut vtt_engine = "whisper_local".to_string();
    let mut vtt_custom_endpoint: Option<String> = None;
    let mut vtt_api_key: Option<String> = None;

    if config_path.exists() {
        if let Ok(raw) = fs::read_to_string(&config_path) {
            if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(ws) = cfg.get("defaultWorkspaceDir").and_then(|v| v.as_str()) {
                    default_workspace_dir = ws.to_string();
                }
                if let Some(sh) = cfg.get("defaultTerminalShell").and_then(|v| v.as_str()) {
                    default_terminal_shell = sh.to_string();
                }
                if let Some(appr) = cfg.get("askForApproval").and_then(|v| v.as_bool()) {
                    ask_for_approval = appr;
                }
                if let Some(ast) = cfg.get("astSafetyEnforced").and_then(|v| v.as_bool()) {
                    ast_safety_enforced = ast;
                }
                if let Some(tel) = cfg.get("telemetry").and_then(|t| t.get("enabled")).and_then(|v| v.as_bool()) {
                    telemetry_enabled = tel;
                }
                if let Some(orch) = cfg.get("defaultRoutes").and_then(|r| r.get("orchestrator")) {
                    if let Some(p) = orch.get("provider").and_then(|v| v.as_str()) {
                        active_provider = p.to_string();
                    }
                }
                if let Some(vtt) = cfg.get("vtt") {
                    if let Some(eng) = vtt.get("engine").and_then(|v| v.as_str()) {
                        vtt_engine = eng.to_string();
                    }
                    if let Some(endp) = vtt.get("customEndpoint").and_then(|v| v.as_str()) {
                        vtt_custom_endpoint = Some(endp.to_string());
                    }
                    if let Some(k) = vtt.get("apiKey").and_then(|v| v.as_str()) {
                        vtt_api_key = Some(k.to_string());
                    }
                }
                if let Some(app) = cfg.get("appearance") {
                    if let Some(t) = app.get("theme").and_then(|v| v.as_str()) {
                        theme = t.to_string();
                    }
                    if let Some(f) = app.get("fontSize").and_then(|v| v.as_str()) {
                        font_size = f.to_string();
                    }
                    if let Some(d) = app.get("density").and_then(|v| v.as_str()) {
                        ui_density = d.to_string();
                    }
                }
            }
        }
    }

    let mut providers: Vec<ProviderKeySetting> = Vec::new();
    let known_providers = vec!["openai", "anthropic", "openrouter", "ollama", "custom"];

    let creds_json: serde_json::Value = if creds_path.exists() {
        fs::read_to_string(&creds_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    for p in known_providers {
        let key_name = format!("{}_api_key", p);
        let url_name = format!("{}_base_url", p);
        let model_name = format!("{}_custom_model", p);

        let api_key = creds_json.get(&key_name).and_then(|v| v.as_str()).map(String::from);
        let base_url = creds_json.get(&url_name).and_then(|v| v.as_str()).map(String::from);
        let custom_model = creds_json.get(&model_name).and_then(|v| v.as_str()).map(String::from);

        providers.push(ProviderKeySetting {
            provider: p.to_string(),
            api_key,
            base_url,
            custom_model,
        });
    }

    Ok(AppSettingsResult {
        default_workspace_dir,
        default_terminal_shell,
        ask_for_approval,
        ast_safety_enforced,
        telemetry_enabled,
        active_provider,
        theme,
        font_size,
        ui_density,
        providers,
        vtt_engine,
        vtt_custom_endpoint,
        vtt_api_key,
    })
}

/// Saves updated global settings and provider credentials immediately
#[tauri::command]
pub fn save_app_settings(payload: AppSettingsPayload) -> Result<bool, String> {
    ensure_krypton_directories()?;
    let home = get_krypton_home();
    let config_path = home.join("config.json");
    let creds_path = home.join("credentials.json");

    let mut config: serde_json::Value = if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(ws) = payload.default_workspace_dir {
        config["defaultWorkspaceDir"] = serde_json::json!(ws);
    }
    if let Some(sh) = payload.default_terminal_shell {
        config["defaultTerminalShell"] = serde_json::json!(sh);
    }
    if let Some(appr) = payload.ask_for_approval {
        config["askForApproval"] = serde_json::json!(appr);
    }
    if let Some(ast) = payload.ast_safety_enforced {
        config["astSafetyEnforced"] = serde_json::json!(ast);
    }
    if let Some(tel) = payload.telemetry_enabled {
        config["telemetry"] = serde_json::json!({
            "enabled": tel,
            "logLevel": "info"
        });
    }
    if let Some(p) = payload.active_provider {
        if let Some(routes) = config.get_mut("defaultRoutes") {
            if let Some(orch) = routes.get_mut("orchestrator") {
                orch["provider"] = serde_json::json!(p);
            }
        }
    }

    // Appearance
    let mut appearance = config.get("appearance").cloned().unwrap_or(serde_json::json!({}));
    if let Some(th) = payload.theme {
        appearance["theme"] = serde_json::json!(th);
    }
    if let Some(fsz) = payload.font_size {
        appearance["fontSize"] = serde_json::json!(fsz);
    }
    if let Some(den) = payload.ui_density {
        appearance["density"] = serde_json::json!(den);
    }
    config["appearance"] = appearance;

    if payload.vtt_engine.is_some() || payload.vtt_custom_endpoint.is_some() || payload.vtt_api_key.is_some() {
        let mut vtt = config.get("vtt").cloned().unwrap_or(serde_json::json!({}));
        if let Some(eng) = payload.vtt_engine {
            let vtt_architecture = match eng.as_str() {
                "nvidia/parakeet-tdt-0.6b-v3" => "conformer_rnnt_tdt",
                "whisper_api" => "cloud_api",
                "custom" => "custom",
                _ => "encoder_decoder_autoregressive",
            };
            vtt["engine"] = serde_json::json!(eng);
            vtt["architecture"] = serde_json::json!(vtt_architecture);
        }
        if let Some(endp) = payload.vtt_custom_endpoint {
            if endp.trim().is_empty() {
                if let Some(obj) = vtt.as_object_mut() {
                    obj.remove("customEndpoint");
                }
            } else {
                vtt["customEndpoint"] = serde_json::json!(endp.trim());
            }
        }
        if let Some(key) = payload.vtt_api_key {
            if key.trim().is_empty() {
                if let Some(obj) = vtt.as_object_mut() {
                    obj.remove("apiKey");
                }
            } else {
                vtt["apiKey"] = serde_json::json!(key.trim());
            }
        }
        config["vtt"] = vtt;
    }

    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, serialized)
        .map_err(|e| format!("Failed to write config {:?}: {}", config_path, e))?;

    // Credentials
    if let Some(prov_list) = payload.providers {
        let mut creds: serde_json::Map<String, serde_json::Value> = if creds_path.exists() {
            fs::read_to_string(&creds_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            serde_json::Map::new()
        };

        for p in prov_list {
            let p_name = p.provider.to_lowercase();
            let key_name = format!("{}_api_key", p_name);
            let url_name = format!("{}_base_url", p_name);
            let model_name = format!("{}_custom_model", p_name);

            if let Some(k) = p.api_key {
                if k.trim().is_empty() {
                    creds.remove(&key_name);
                } else {
                    creds.insert(key_name, serde_json::json!(k.trim()));
                }
            }
            if let Some(u) = p.base_url {
                if u.trim().is_empty() {
                    creds.remove(&url_name);
                } else {
                    creds.insert(url_name, serde_json::json!(u.trim()));
                }
            }
            if let Some(m) = p.custom_model {
                if m.trim().is_empty() {
                    creds.remove(&model_name);
                } else {
                    creds.insert(model_name, serde_json::json!(m.trim()));
                }
            }
        }

        let serialized_creds = serde_json::to_string_pretty(&creds)
            .map_err(|e| format!("Failed to serialize credentials: {}", e))?;
        fs::write(&creds_path, serialized_creds)
            .map_err(|e| format!("Failed to write credentials {:?}: {}", creds_path, e))?;
    }

    Ok(true)
}

/// Saves agent configuration strictly to ~/.krypton/agents/<agent_name>/config.json
#[tauri::command]
pub fn save_agent_config(agent_name: String, config: serde_json::Value) -> Result<bool, String> {
    ensure_krypton_directories()?;
    let home = get_krypton_home();
    let sanitized_name = agent_name.trim();
    if sanitized_name.is_empty() {
        return Err("Agent name is required".to_string());
    }

    let agent_dir = home.join("agents").join(sanitized_name);
    if !agent_dir.exists() {
        fs::create_dir_all(&agent_dir)
            .map_err(|e| format!("Failed to create agent dir {:?}: {}", agent_dir, e))?;
    }

    let config_path = agent_dir.join("config.json");
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialization error: {}", e))?;

    fs::write(&config_path, serialized)
        .map_err(|e| format!("Failed to write agent config {:?}: {}", config_path, e))?;

    Ok(true)
}

/// Lists all agent configurations found in ~/.krypton/agents/
#[tauri::command]
pub fn list_agents_config() -> Result<Vec<serde_json::Value>, String> {
    let home = get_krypton_home();
    let agents_dir = home.join("agents");
    let mut result: Vec<serde_json::Value> = Vec::new();

    if !agents_dir.exists() {
        return Ok(result);
    }

    if let Ok(entries) = fs::read_dir(&agents_dir) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_dir() {
                    let cfg_path = entry.path().join("config.json");
                    if cfg_path.exists() {
                        if let Ok(raw) = fs::read_to_string(&cfg_path) {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                                result.push(json);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(result)
}

/// Deletes an agent workspace directory from ~/.krypton/agents/<agent_name>
#[tauri::command]
pub fn delete_agent_config(agent_name: String) -> Result<bool, String> {
    ensure_krypton_directories()?;
    let home = get_krypton_home();
    let sanitized_name = agent_name.trim();
    if sanitized_name.is_empty() {
        return Err("Agent name is required".to_string());
    }

    let lower = sanitized_name.to_lowercase();
    if lower == "agent-root" || lower == "root" || lower == "orchestrator" {
        return Err(format!("Cannot delete protected root agent workspace: {}", sanitized_name));
    }

    let agent_dir = home.join("agents").join(sanitized_name);
    if agent_dir.exists() {
        fs::remove_dir_all(&agent_dir)
            .map_err(|e| format!("Failed to delete agent directory {:?}: {}", agent_dir, e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Provisions a new agent workspace with config.json and template IDENTITY.md
#[tauri::command]
pub fn create_agent_workspace(
    agent_name: String,
    config: serde_json::Value,
    template_identity: Option<String>,
) -> Result<serde_json::Value, String> {
    ensure_krypton_directories()?;
    let home = get_krypton_home();
    let sanitized_name = agent_name.trim();
    if sanitized_name.is_empty() {
        return Err("Agent name is required".to_string());
    }

    let agent_dir = home.join("agents").join(sanitized_name);
    if !agent_dir.exists() {
        fs::create_dir_all(&agent_dir)
            .map_err(|e| format!("Failed to create agent dir {:?}: {}", agent_dir, e))?;
    }

    let config_path = agent_dir.join("config.json");
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Serialization error: {}", e))?;
    fs::write(&config_path, serialized)
        .map_err(|e| format!("Failed to write agent config {:?}: {}", config_path, e))?;

    let identity_path = agent_dir.join("IDENTITY.md");
    let identity_content = template_identity.unwrap_or_else(|| {
        format!(
            "# IDENTITY.md - {}\n\nYou are {}, an autonomous agent configured in Krypton.\n\n- **Name:** {}\n- **Vibe:** Focused, autonomous, reliable\n",
            sanitized_name, sanitized_name, sanitized_name
        )
    });

    fs::write(&identity_path, identity_content)
        .map_err(|e| format!("Failed to write agent IDENTITY.md {:?}: {}", identity_path, e))?;

    Ok(config)
}


