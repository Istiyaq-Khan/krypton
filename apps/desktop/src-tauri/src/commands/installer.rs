use std::fs;
use crate::paths::get_krypton_home;

#[tauri::command]
pub async fn install_cli_to_path() -> Result<String, String> {
    let krypton_home = get_krypton_home();
    let bin_dir = krypton_home.join("bin");
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| format!("Failed to create bin dir: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, create a batch wrapper in ~/.krypton/bin and ensure bin is in User PATH
        let batch_wrapper = bin_dir.join("krypton.cmd");
        let script_content = "@echo off\r\nnode \"%~dp0..\\cli\\dist\\index.js\" %*\r\n";
        let _ = fs::write(&batch_wrapper, script_content);

        // Check if directory is in PATH or update registry
        let bin_str = bin_dir.to_string_lossy().to_string();
        
        // Attempt registry update via reg add for current user
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
            Ok(s) if s.success() => Ok(format!("Installed krypton CLI wrapper to {} and updated User PATH.", bin_dir.display())),
            _ => Ok(format!("Installed krypton CLI wrapper to {}. Please add {} to your PATH.", bin_dir.display(), bin_dir.display()))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On macOS / Linux, try symlinking to /usr/local/bin/krypton or ~/.local/bin/krypton
        let target_symlink = std::path::PathBuf::from("/usr/local/bin/krypton");
        let source_bin = bin_dir.join("krypton");

        if let Err(_) = std::os::unix::fs::symlink(&source_bin, &target_symlink) {
            // Fallback to ~/.local/bin/krypton
            if let Ok(home) = std::env::var("HOME") {
                let local_bin = std::path::PathBuf::from(home).join(".local").join("bin");
                let _ = fs::create_dir_all(&local_bin);
                let fallback_link = local_bin.join("krypton");
                let _ = std::os::unix::fs::symlink(&source_bin, &fallback_link);
                return Ok(format!("Created symlink at {}", fallback_link.display()));
            }
        }

        Ok(format!("Installed CLI symlink to {}", target_symlink.display()))
    }
}
