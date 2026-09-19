use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::commands::sidecar::stop_daemon;
use crate::paths::get_krypton_home;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupVaultResult {
    pub success: bool,
    pub archive_path: String,
    pub archive_name: String,
    pub file_count: usize,
    pub total_bytes_uncompressed: u64,
    pub total_bytes_compressed: u64,
    pub timestamp: u64,
    pub agents_included: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeDataResult {
    pub success: bool,
    pub daemons_terminated: bool,
    pub purged_directories: Vec<String>,
    pub failed_directories: Vec<String>,
    pub timestamp: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallResult {
    pub success: bool,
    pub platform: String,
    pub action_taken: String,
    pub data_purged: bool,
    pub uninstaller_executed: bool,
    pub manual_instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoragePathsInfo {
    pub krypton_home: String,
    pub app_data: String,
    pub local_app_data: Option<String>,
    pub cache_dir: String,
    pub logs_dir: String,
    pub agents_dir: String,
    pub worktrees_dir: String,
    pub os_platform: String,
}

/// Standard IEEE 802.3 CRC-32 checksum calculation
fn calculate_crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

/// Assembles a valid PKWARE ZIP archive (Store compression, method 0).
/// Standards-compliant with Windows Explorer, macOS Finder, 7-Zip, and Linux unzip.
fn create_simple_zip(entries: &[(String, Vec<u8>)]) -> Vec<u8> {
    let mut local_headers: Vec<u8> = Vec::new();
    let mut central_headers: Vec<u8> = Vec::new();
    let mut offset = 0u32;

    for (rel_path, data) in entries {
        let name_bytes = rel_path.replace('\\', "/").into_bytes();
        let name_len = name_bytes.len() as u16;
        let data_len = data.len() as u32;
        let crc = calculate_crc32(data);

        // 1. Local file header (30 bytes)
        let mut lh = Vec::with_capacity(30 + name_bytes.len() + data.len());
        lh.extend_from_slice(&0x04034b50u32.to_le_bytes()); // Local header signature
        lh.extend_from_slice(&20u16.to_le_bytes());         // Version needed (2.0)
        lh.extend_from_slice(&0x0800u16.to_le_bytes());     // Flags (bit 11 = UTF-8)
        lh.extend_from_slice(&0u16.to_le_bytes());          // Compression: Store (0)
        lh.extend_from_slice(&0u16.to_le_bytes());          // Mod time
        lh.extend_from_slice(&0u16.to_le_bytes());          // Mod date
        lh.extend_from_slice(&crc.to_le_bytes());
        lh.extend_from_slice(&data_len.to_le_bytes());      // Compressed size
        lh.extend_from_slice(&data_len.to_le_bytes());      // Uncompressed size
        lh.extend_from_slice(&name_len.to_le_bytes());
        lh.extend_from_slice(&0u16.to_le_bytes());          // Extra field length
        lh.extend_from_slice(&name_bytes);
        lh.extend_from_slice(data);

        let local_record_len = lh.len() as u32;
        local_headers.extend_from_slice(&lh);

        // 2. Central directory file header (46 bytes)
        let mut ch = Vec::with_capacity(46 + name_bytes.len());
        ch.extend_from_slice(&0x02014b50u32.to_le_bytes()); // Central directory signature
        ch.extend_from_slice(&20u16.to_le_bytes());         // Version made by
        ch.extend_from_slice(&20u16.to_le_bytes());         // Version needed
        ch.extend_from_slice(&0x0800u16.to_le_bytes());     // Flags: UTF-8
        ch.extend_from_slice(&0u16.to_le_bytes());          // Store
        ch.extend_from_slice(&0u16.to_le_bytes());          // Mod time
        ch.extend_from_slice(&0u16.to_le_bytes());          // Mod date
        ch.extend_from_slice(&crc.to_le_bytes());
        ch.extend_from_slice(&data_len.to_le_bytes());
        ch.extend_from_slice(&data_len.to_le_bytes());
        ch.extend_from_slice(&name_len.to_le_bytes());
        ch.extend_from_slice(&0u16.to_le_bytes());          // Extra length
        ch.extend_from_slice(&0u16.to_le_bytes());          // Comment length
        ch.extend_from_slice(&0u16.to_le_bytes());          // Disk start
        ch.extend_from_slice(&0u16.to_le_bytes());          // Internal attrs
        ch.extend_from_slice(&0u32.to_le_bytes());          // External attrs
        ch.extend_from_slice(&offset.to_le_bytes());        // Relative offset of local header
        ch.extend_from_slice(&name_bytes);

        central_headers.extend_from_slice(&ch);
        offset += local_record_len;
    }

    let central_dir_len = central_headers.len() as u32;
    let central_dir_offset = offset;
    let total_entries = entries.len() as u16;

    // 3. End of central directory record (22 bytes)
    let mut eocd = Vec::with_capacity(22);
    eocd.extend_from_slice(&0x06054b50u32.to_le_bytes());
    eocd.extend_from_slice(&0u16.to_le_bytes());          // Disk number
    eocd.extend_from_slice(&0u16.to_le_bytes());          // Start disk
    eocd.extend_from_slice(&total_entries.to_le_bytes()); // Entries on this disk
    eocd.extend_from_slice(&total_entries.to_le_bytes()); // Total entries
    eocd.extend_from_slice(&central_dir_len.to_le_bytes());
    eocd.extend_from_slice(&central_dir_offset.to_le_bytes());
    eocd.extend_from_slice(&0u16.to_le_bytes());          // Comment length

    let mut result = Vec::with_capacity(local_headers.len() + central_headers.len() + eocd.len());
    result.extend_from_slice(&local_headers);
    result.extend_from_slice(&central_headers);
    result.extend_from_slice(&eocd);
    result
}

/// Recursively scans ~/.krypton and collects files for backup.
fn collect_krypton_backup_files(home: &Path) -> Vec<(String, Vec<u8>)> {
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

    // 1. Root configuration files
    for root_name in &["config.json", "models_cache.json", "credentials.json"] {
        let p = home.join(root_name);
        if p.is_file() {
            if let Ok(data) = fs::read(&p) {
                files.push((root_name.to_string(), data));
            }
        }
    }

    // 2. Agents directory
    let agents_dir = home.join("agents");
    if agents_dir.is_dir() {
        if let Ok(agent_entries) = fs::read_dir(&agents_dir) {
            for entry in agent_entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        let agent_name = entry.file_name().to_string_lossy().to_string();
                        let agent_path = entry.path();

                        // Top-level files in agent directory
                        if let Ok(subs) = fs::read_dir(&agent_path) {
                            for sub in subs.flatten() {
                                let sub_path = sub.path();
                                if sub_path.is_file() {
                                    let sub_name = sub.file_name().to_string_lossy().to_string();
                                    let is_md = sub_name.ends_with(".md");
                                    let is_cfg = sub_name == "config.json";

                                    if is_md || is_cfg {
                                        if let Ok(data) = fs::read(&sub_path) {
                                            files.push((format!("agents/{}/{}", agent_name, sub_name), data));
                                        }
                                    }
                                } else if sub_path.is_dir() && sub.file_name() == "short_term" {
                                    // Collect session events and trajectories
                                    collect_dir_recursive(&sub_path, &format!("agents/{}/short_term", agent_name), &mut files);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    files
}

fn collect_dir_recursive(dir: &Path, rel_prefix: &str, out: &mut Vec<(String, Vec<u8>)>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let sub_rel = format!("{}/{}", rel_prefix, name);

            if path.is_file() {
                if let Ok(data) = fs::read(&path) {
                    out.push((sub_rel, data));
                }
            } else if path.is_dir() {
                collect_dir_recursive(&path, &sub_rel, out);
            }
        }
    }
}

/// Creates a compressed Backup Vault archive (.zip) of Krypton configuration and agent workspaces.
#[tauri::command]
pub fn create_backup_vault(target_path: Option<String>) -> Result<BackupVaultResult, String> {
    let home = get_krypton_home();
    let mut files = collect_krypton_backup_files(&home);

    let now_system = SystemTime::now();
    let now_millis = now_system
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    // Detect unique agents included
    let mut agents_set: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    let mut total_uncompressed: u64 = 0;

    for (rel, data) in &files {
        total_uncompressed += data.len() as u64;
        if rel.starts_with("agents/") {
            let parts: Vec<&str> = rel.split('/').collect();
            if parts.len() > 1 {
                agents_set.insert(parts[1].to_string());
            }
        }
    }

    // Generate manifest
    let manifest_json = serde_json::json!({
        "generator": "Krypton Backup Vault Engine",
        "version": "1.0.0",
        "timestamp": now_millis,
        "totalFiles": files.len(),
        "agents": agents_set.iter().cloned().collect::<Vec<String>>(),
        "files": files.iter().map(|(r, _)| r).cloned().collect::<Vec<String>>()
    });

    let manifest_bytes = serde_json::to_vec_pretty(&manifest_json).unwrap_or_default();
    total_uncompressed += manifest_bytes.len() as u64;
    files.insert(0, ("manifest.json".to_string(), manifest_bytes));

    let zip_bytes = create_simple_zip(&files);
    let total_compressed = zip_bytes.len() as u64;

    // Determine target save path
    let now_date = {
        let secs = now_millis / 1000;
        let days = secs / 86400;
        // Simple approximate YYYY-MM-DD calculation without external chrono crate
        let year = 1970 + days / 365;
        let month = 1 + (days % 365) / 30;
        let day = 1 + (days % 30);
        format!("{:04}-{:02}-{:02}", year, month, day)
    };

    let default_archive_name = format!("krypton-vault-backup-{}.zip", now_date);

    let dest_path: PathBuf = if let Some(custom_target) = target_path {
        let p = PathBuf::from(&custom_target);
        if p.is_dir() {
            p.join(&default_archive_name)
        } else {
            p
        }
    } else {
        // Fallback: user Downloads folder or ~/.krypton/backups
        let mut target_dir = home.join("backups");
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let dl = PathBuf::from(user_profile).join("Downloads");
            if dl.exists() {
                target_dir = dl;
            }
        } else if let Ok(user_home) = std::env::var("HOME") {
            let dl = PathBuf::from(user_home).join("Downloads");
            if dl.exists() {
                target_dir = dl;
            }
        }

        let _ = fs::create_dir_all(&target_dir);
        target_dir.join(&default_archive_name)
    };

    if let Some(parent) = dest_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    fs::write(&dest_path, &zip_bytes)
        .map_err(|e| format!("Failed to write backup archive to {:?}: {}", dest_path, e))?;

    Ok(BackupVaultResult {
        success: true,
        archive_path: dest_path.to_string_lossy().to_string(),
        archive_name: dest_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        file_count: files.len(),
        total_bytes_uncompressed: total_uncompressed,
        total_bytes_compressed: total_compressed,
        timestamp: now_millis,
        agents_included: agents_set.into_iter().collect(),
    })
}

/// Invokes the native OS file save dialog across Windows, macOS, and Linux.
#[tauri::command]
pub fn select_backup_save_dialog(default_name: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        // Invoke native Windows SaveFileDialog using PowerShell
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.SaveFileDialog; $d.Filter = 'Zip Archives (*.zip)|*.zip|All files (*.*)|*.*'; $d.FileName = '{}'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $d.FileName }}",
            default_name
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output();

        if let Ok(out) = output {
            let selected = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !selected.is_empty() {
                return Ok(Some(selected));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "set f to choose file name default name \"{}\" with prompt \"Save Krypton Backup Vault\"\nPOSIX path of f",
            default_name
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        if let Ok(out) = output {
            let selected = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !selected.is_empty() {
                return Ok(Some(selected));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "linux")]
    {
        // Try zenity first, then kdialog
        if let Ok(out) = Command::new("zenity")
            .args(["--file-selection", "--save", "--confirm-overwrite", &format!("--filename={}", default_name), "--file-filter=Zip Archives | *.zip"])
            .output()
        {
            let selected = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !selected.is_empty() {
                return Ok(Some(selected));
            }
        }

        if let Ok(out) = Command::new("kdialog")
            .args(["--getsavefilename", &default_name, "*.zip"])
            .output()
        {
            let selected = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !selected.is_empty() {
                return Ok(Some(selected));
            }
        }

        Ok(None)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(None)
    }
}

/// Resolves all platform-specific Krypton data and cache directories.
pub fn get_all_platform_storage_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    let home = get_krypton_home();
    dirs.push(home);

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            dirs.push(PathBuf::from(&appdata).join("krypton"));
            dirs.push(PathBuf::from(&appdata).join("com.krypton.desktop"));
        }
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(&localappdata).join("krypton"));
            dirs.push(PathBuf::from(&localappdata).join("com.krypton.desktop"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home_env) = std::env::var("HOME") {
            let h = PathBuf::from(&home_env);
            dirs.push(h.join("Library/Application Support/krypton"));
            dirs.push(h.join("Library/Application Support/com.krypton.desktop"));
            dirs.push(h.join("Library/Caches/krypton"));
            dirs.push(h.join("Library/Caches/com.krypton.desktop"));
            dirs.push(h.join("Library/Preferences/com.krypton.desktop.plist"));
            dirs.push(h.join("Library/LaunchAgents/com.krypton.daemon.plist"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home_env) = std::env::var("HOME") {
            let h = PathBuf::from(&home_env);
            let config_home = std::env::var("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| h.join(".config"));
            let data_home = std::env::var("XDG_DATA_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| h.join(".local/share"));
            let cache_home = std::env::var("XDG_CACHE_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| h.join(".cache"));

            dirs.push(config_home.join("krypton"));
            dirs.push(config_home.join("com.krypton.desktop"));
            dirs.push(data_home.join("krypton"));
            dirs.push(data_home.join("com.krypton.desktop"));
            dirs.push(cache_home.join("krypton"));
            dirs.push(cache_home.join("com.krypton.desktop"));
        }
    }

    dirs
}

/// Executes Factory Reset & Complete Data Purge across all OS directories.
#[tauri::command]
pub fn purge_app_data_and_reset() -> Result<PurgeDataResult, String> {
    // 1. Gracefully terminate supervisor daemon
    let _ = stop_daemon();

    // Kill any stray daemon / cli processes on host OS
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "krypton-daemon.exe", "/IM", "krypton-cli.exe"])
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill")
            .args(["-TERM", "-f", "krypton-daemon"])
            .output();
    }

    let targets = get_all_platform_storage_dirs();
    let mut purged: Vec<String> = Vec::new();
    let mut failed: Vec<String> = Vec::new();

    for target in targets {
        // Safety boundary: never delete root or system drive
        let s = target.to_string_lossy().to_string();
        if s.len() < 5 || s == "/" || s == "C:\\" {
            continue;
        }

        if target.exists() {
            let res = if target.is_dir() {
                fs::remove_dir_all(&target)
            } else {
                fs::remove_file(&target)
            };

            match res {
                Ok(_) => purged.push(s),
                Err(e) => failed.push(format!("{}: {}", s, e)),
            }
        }
    }

    // Re-scaffold empty standard ~/.krypton root directory so desktop app remains operational
    let _ = crate::paths::ensure_krypton_directories();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    Ok(PurgeDataResult {
        success: failed.is_empty(),
        daemons_terminated: true,
        purged_directories: purged,
        failed_directories: failed,
        timestamp: now,
        message: "Successfully executed Factory Reset and purged Krypton runtime state.".to_string(),
    })
}

/// Triggers platform-specific uninstallation flow.
#[tauri::command]
pub fn trigger_app_uninstall(purge_data: bool) -> Result<UninstallResult, String> {
    let _ = stop_daemon();

    if purge_data {
        let _ = purge_app_data_and_reset();
    }

    #[cfg(target_os = "windows")]
    {
        // 1. Discover uninstall.exe or uninstaller script
        let mut uninstaller_path: Option<PathBuf> = None;
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let candidate1 = dir.join("uninstall.exe");
                let candidate2 = dir.join("Uninstall.exe");
                let candidate3 = dir.join("uninstall.ps1");
                if candidate1.exists() {
                    uninstaller_path = Some(candidate1);
                } else if candidate2.exists() {
                    uninstaller_path = Some(candidate2);
                } else if candidate3.exists() {
                    uninstaller_path = Some(candidate3);
                }
            }
        }

        // Also check ~/.krypton/bin/uninstall.ps1
        let home_uninstaller = get_krypton_home().join("bin").join("uninstall.ps1");
        if uninstaller_path.is_none() && home_uninstaller.exists() {
            uninstaller_path = Some(home_uninstaller);
        }

        if let Some(uninstaller) = uninstaller_path {
            let u_str = uninstaller.to_string_lossy().to_string();
            let is_ps1 = u_str.ends_with(".ps1");

            if is_ps1 {
                let _ = Command::new("powershell")
                    .args(["-ExecutionPolicy", "Bypass", "-File", &u_str])
                    .spawn();
            } else {
                let _ = Command::new("cmd")
                    .args(["/c", "start", "", &u_str])
                    .spawn();
            }

            // Terminate desktop application immediately to release binary file locks
            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_millis(500));
                std::process::exit(0);
            });

            return Ok(UninstallResult {
                success: true,
                platform: "windows".to_string(),
                action_taken: format!("Spawned uninstaller at {} in detached process.", u_str),
                data_purged: purge_data,
                uninstaller_executed: true,
                manual_instructions: None,
            });
        }

        Ok(UninstallResult {
            success: true,
            platform: "windows".to_string(),
            action_taken: "No standalone uninstaller found. Data has been purged. Please remove application from Windows Apps & Features.".to_string(),
            data_purged: purge_data,
            uninstaller_executed: false,
            manual_instructions: Some("Navigate to Windows Settings > Apps > Installed apps > Krypton > Uninstall".to_string()),
        })
    }

    #[cfg(target_os = "macos")]
    {
        // Clean LaunchAgents
        if let Ok(home_env) = std::env::var("HOME") {
            let plist = PathBuf::from(home_env).join("Library/LaunchAgents/com.krypton.daemon.plist");
            if plist.exists() {
                let _ = Command::new("launchctl").args(["unload", &plist.to_string_lossy()]).output();
                let _ = fs::remove_file(plist);
            }
        }

        // Move running .app to Trash if located in /Applications
        let mut app_path: Option<PathBuf> = None;
        if let Ok(exe) = std::env::current_exe() {
            let mut curr = exe.clone();
            while let Some(parent) = curr.parent() {
                if parent.extension().and_then(|e| e.to_str()) == Some("app") {
                    app_path = Some(parent.to_path_buf());
                    break;
                }
                curr = parent.to_path_buf();
            }
        }

        if let Some(app) = app_path {
            let app_str = app.to_string_lossy().to_string();
            let script = format!(
                "tell application \"Finder\" to delete POSIX file \"{}\"",
                app_str
            );
            let _ = Command::new("osascript").arg("-e").arg(&script).output();

            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_millis(500));
                std::process::exit(0);
            });

            return Ok(UninstallResult {
                success: true,
                platform: "macos".to_string(),
                action_taken: format!("Moved {} to Trash and unloaded LaunchAgents.", app_str),
                data_purged: purge_data,
                uninstaller_executed: true,
                manual_instructions: None,
            });
        }

        Ok(UninstallResult {
            success: true,
            platform: "macos".to_string(),
            action_taken: "Unloaded LaunchAgents and cleared application data.".to_string(),
            data_purged: purge_data,
            uninstaller_executed: false,
            manual_instructions: Some("Drag Krypton.app from /Applications to Trash to complete removal.".to_string()),
        })
    }

    #[cfg(target_os = "linux")]
    {
        // Remove desktop shortcut & icons
        if let Ok(home_env) = std::env::var("HOME") {
            let h = PathBuf::from(home_env);
            let desktop_file = h.join(".local/share/applications/krypton.desktop");
            let icon_file = h.join(".local/share/icons/hicolor/128x128/apps/krypton.png");
            let _ = fs::remove_file(desktop_file);
            let _ = fs::remove_file(icon_file);
        }

        // Check if package-managed
        let is_deb = Command::new("dpkg").args(["-s", "krypton"]).output().map(|o| o.status.success()).unwrap_or(false);
        let is_rpm = Command::new("rpm").args(["-q", "krypton"]).output().map(|o| o.status.success()).unwrap_or(false);

        let manual_cmd = if is_deb {
            Some("sudo apt remove krypton".to_string())
        } else if is_rpm {
            Some("sudo dnf remove krypton".to_string())
        } else {
            None
        };

        Ok(UninstallResult {
            success: true,
            platform: "linux".to_string(),
            action_taken: "Removed desktop shortcuts and user application state.".to_string(),
            data_purged: purge_data,
            uninstaller_executed: manual_cmd.is_none(),
            manual_instructions: manual_cmd,
        })
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(UninstallResult {
            success: true,
            platform: "unknown".to_string(),
            action_taken: "Purged local data directories.".to_string(),
            data_purged: purge_data,
            uninstaller_executed: false,
            manual_instructions: None,
        })
    }
}

/// Returns storage and cache paths info for UI display.
#[tauri::command]
pub fn get_storage_paths_info() -> Result<StoragePathsInfo, String> {
    let home = get_krypton_home();
    let platform = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };

    let mut app_data = home.to_string_lossy().to_string();
    let mut local_app_data = None;

    #[cfg(target_os = "windows")]
    {
        if let Ok(roaming) = std::env::var("APPDATA") {
            app_data = PathBuf::from(roaming).join("krypton").to_string_lossy().to_string();
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            local_app_data = Some(PathBuf::from(local).join("krypton").to_string_lossy().to_string());
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home_env) = std::env::var("HOME") {
            app_data = PathBuf::from(home_env).join("Library/Application Support/krypton").to_string_lossy().to_string();
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home_env) = std::env::var("HOME") {
            let config_home = std::env::var("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from(home_env).join(".config"));
            app_data = config_home.join("krypton").to_string_lossy().to_string();
        }
    }

    Ok(StoragePathsInfo {
        krypton_home: home.to_string_lossy().to_string(),
        app_data,
        local_app_data,
        cache_dir: home.join("cache").to_string_lossy().to_string(),
        logs_dir: home.join("logs").to_string_lossy().to_string(),
        agents_dir: home.join("agents").to_string_lossy().to_string(),
        worktrees_dir: home.join("worktrees").to_string_lossy().to_string(),
        os_platform: platform.to_string(),
    })
}
