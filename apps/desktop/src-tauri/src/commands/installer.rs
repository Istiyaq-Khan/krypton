use std::fs;
use std::path::PathBuf;
use crate::paths::get_krypton_home;

fn find_bundled_cli() -> Option<PathBuf> {
    let cli_name = if cfg!(target_os = "windows") {
        "krypton-cli.exe"
    } else {
        "krypton-cli"
    };

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(cli_name));
            candidates.push(exe_dir.join("binaries").join(cli_name));
            candidates.push(exe_dir.join("../Resources").join(cli_name));
            candidates.push(exe_dir.join("../Resources/binaries").join(cli_name));
            candidates.push(exe_dir.join("../MacOS").join(cli_name));
        }
    }

    // Dev fallbacks
    candidates.push(PathBuf::from(format!("apps/desktop/src-tauri/binaries/{}", cli_name)));
    candidates.push(PathBuf::from(format!("binaries/{}", cli_name)));
    candidates.push(PathBuf::from(if cfg!(target_os = "windows") { "krypton.exe" } else { "krypton" }));
    candidates.push(PathBuf::from(if cfg!(target_os = "windows") { "packages/cli/dist/krypton.exe" } else { "packages/cli/dist/krypton" }));

    candidates.into_iter().find(|p| p.exists())
}

#[tauri::command]
pub async fn install_cli_to_path() -> Result<String, String> {
    let krypton_home = get_krypton_home();
    let bin_dir = krypton_home.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| format!("Failed to create bin dir: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        let target_exe = bin_dir.join("krypton.exe");
        let bundled = find_bundled_cli();

        if let Some(src_bin) = bundled {
            let _ = fs::copy(&src_bin, &target_exe);
        } else {
            // Fallback: create a batch wrapper in ~/.krypton/bin
            let batch_wrapper = bin_dir.join("krypton.cmd");
            let script_content = "@echo off\r\nnode \"%~dp0..\\cli\\dist\\index.js\" %*\r\n";
            let _ = fs::write(&batch_wrapper, script_content);
        }

        // Check if directory is in PATH or update registry
        let bin_str = bin_dir.to_string_lossy().to_string();

        let status = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "$p = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($p -notlike '*{0}*') {{ [Environment]::SetEnvironmentVariable('Path', $p + ';{0}', 'User') }}",
                    bin_str
                ),
            ])
            .status();

        match status {
            Ok(s) if s.success() => Ok(format!("Installed krypton CLI to {} and updated User PATH.", bin_dir.display())),
            _ => Ok(format!("Installed krypton CLI to {}. Please ensure {} is in your PATH.", bin_dir.display(), bin_dir.display()))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let target_bin = bin_dir.join("krypton");
        let bundled = find_bundled_cli();

        if let Some(src_bin) = bundled {
            let _ = fs::copy(&src_bin, &target_bin);
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(&target_bin, fs::Permissions::from_mode(0o755));
            }
        }

        let target_symlink = std::path::PathBuf::from("/usr/local/bin/krypton");
        if let Err(_) = std::os::unix::fs::symlink(&target_bin, &target_symlink) {
            if let Ok(home) = std::env::var("HOME") {
                let local_bin = std::path::PathBuf::from(home).join(".local").join("bin");
                let _ = fs::create_dir_all(&local_bin);
                let fallback_link = local_bin.join("krypton");
                let _ = std::os::unix::fs::symlink(&target_bin, &fallback_link);
                return Ok(format!("Installed krypton CLI binary and created symlink at {}", fallback_link.display()));
            }
        }

        Ok(format!("Installed krypton CLI binary and created symlink at {}", target_symlink.display()))
    }
}
