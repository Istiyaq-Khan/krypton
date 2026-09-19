# Application Lifecycle, Backup Vault & Clean Uninstallation

This document specifies the OS-level uninstallation registration, in-app backup vault export architecture, factory reset engine, and clean application removal procedures for **Krypton**.

---

## 1. Cross-Platform Uninstallation Registration

To ensure native operating system package managers, uninstallation wizards, and third-party cleanup utilities (Windows Apps & Features, IObit Uninstaller, macOS Finder/CleanMyMac, Linux package managers) cleanly detect and remove Krypton:

### A. Windows Registry & Start Menu Integration
The installer script (`scripts/install.ps1`) writes complete uninstall metadata to `HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\krypton`:

| Registry Value | Type | Content / Specification |
| :--- | :--- | :--- |
| `DisplayName` | `REG_SZ` | `"Krypton"` |
| `DisplayVersion` | `REG_SZ` | Current semantic version (e.g. `"1.0.0"`) |
| `Publisher` | `REG_SZ` | `"Krypton Authors"` |
| `DisplayIcon` | `REG_SZ` | Full path to `krypton.exe` or icon asset |
| `InstallLocation`| `REG_SZ` | Target install directory (e.g. `~/.krypton/bin`) |
| `UninstallString` | `REG_SZ` | `powershell.exe -ExecutionPolicy Bypass -File "<InstallDir>\uninstall.ps1"` |
| `QuietUninstallString` | `REG_SZ` | `powershell.exe -ExecutionPolicy Bypass -File "<InstallDir>\uninstall.ps1" -Quiet` |
| `EstimatedSize` | `REG_DWORD`| Approximate footprint in kilobytes |

**Uninstallation Script (`scripts/uninstall.ps1`)**:
- Terminates running instances of `krypton-daemon.exe` and `krypton.exe`.
- Removes Start Menu shortcut (`AppData\Roaming\Microsoft\Windows\Start Menu\Programs\krypton.lnk`).
- Removes binary directory and cleans Registry key `HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\krypton`.
- Optionally purges user configuration (`~/.krypton`) when `-PurgeData` is passed.

### B. macOS Application Bundle & Daemon Registration
- **Bundle Identity**: Configured via `CFBundleIdentifier` (`com.krypton.desktop`) and `CFBundleDisplayName`.
- **LaunchAgent Management**: Background daemons registered under `~/Library/LaunchAgents/com.krypton.daemon.plist` are stopped and unregistered via `launchctl unload` prior to removal.
- **Uninstallation Script (`scripts/uninstall.sh`)**: Unloads LaunchAgent, cleans application support directories, and handles app bundle removal from `/Applications/krypton.app`.

### C. Linux FreeDesktop Integration & Maintainer Hooks
- **Desktop Entry**: Installs `krypton.desktop` to `~/.local/share/applications/krypton.desktop` (or `/usr/share/applications/`) adhering to FreeDesktop standard categories (`Development;IDE;Application;`).
- **Package Hooks**:
  - `scripts/linux/prerm`: Gracefully stops the systemd user service `krypton-daemon.service` and kills active instances.
  - `scripts/linux/postrm`: Removes desktop shortcuts, icons, and systemd service descriptors on package purge (`apt purge` or `dnf remove`).

---

## 2. In-App Backup Vault Engine

Krypton provides a zero-loss data backup vault accessible from **Settings > Data & Maintenance**:

```
[Trigger Backup] ──> Native Save Dialog ──> Recursive Asset Walk ──> Deflate/Store ZIP ──> Timestamped Archive
```

### A. Asset Collection Scope
The backup engine (`collectBackupAssets` / `create_backup_vault`) aggregates all essential, non-reproducible user assets:
- Global configuration (`config.json`)
- Credentials store (`credentials.json` or encrypted format)
- Agent workspaces (`agents/<name>/`):
  - Identity markdown files (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`, `MEMORY.md`, `TODO.md`)
  - Agent-specific machine configurations (`config.json`)
  - Session trajectories and event logs (`short_term/`)
- Dynamically discovered model cache (`models_cache.json`)

### B. Omitted Ephemeral Data
To guarantee fast exports and compact archives, large transient directories are strictly omitted:
- Isolated worktrees (`worktrees/`)
- Offloaded tool output logs (`cache/outputs/`)
- Ephemeral script execution environments (`sandbox_workspace/`)
- PTY terminal buffers (`pty_sessions/`)
- Browser cache profiles and temporary locks

### C. Archive Specification
- **Container Format**: Standard PKWARE ZIP archive (RFC 1951 Deflate / Store with CRC32 integrity verification).
- **Naming Pattern**: `krypton_backup_YYYYMMDD_HHMMSS.zip`.
- **Portability**: Native implementation in both TypeScript (`packages/agent-runtime/src/vault/backup-engine.ts`) and Rust (`apps/desktop/src-tauri/src/commands/maintenance.rs`) requiring zero external system binaries.

---

## 3. Factory Reset & Data Purge Engine

The Factory Reset operation returns the host system to a completely pristine state:

1. **Confirmation Shield**: Requires the user to enter the uppercase token `"RESET"` inside the confirmation modal.
2. **Daemon Termination**: Signals active daemons via `SIGTERM` / `SIGINT` with a 5-second graceful window, followed by `SIGKILL` / `taskkill /F` if needed to release file locks.
3. **Multi-Location Purge**: Recursively deletes:
   - Primary user root (`~/.krypton`)
   - Roaming AppData (`%APPDATA%\krypton` or OS equivalent)
   - Local AppData / WebView2 cache (`%LOCALAPPDATA%\krypton` or `~/Library/Caches/krypton`)
   - OS-specific LaunchAgents and service descriptors
4. **Desktop Re-initialization**: Resets in-memory React states, clears `localStorage`, and transitions the user back to the First-Run Onboarding Setup wizard.

---

## 4. In-App Uninstallation Trigger

Users can initiate complete application uninstallation directly from **Settings > Data & Maintenance**:

- **Execution Flow**:
  1. User selects "Uninstall Krypton" and chooses whether to also purge local configuration data.
  2. The Tauri Rust layer (`trigger_app_uninstall`) invokes the detached OS uninstaller script:
     - **Windows**: Launches detached PowerShell process:
       ```powershell
       Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"<path>\uninstall.ps1`" [-PurgeData]"
       ```
     - **macOS / Linux**: Executes detached uninstaller script `uninstall.sh`.
  3. The desktop app closes cleanly, allowing the uninstaller script to remove all binaries and shortcuts without encountering file lock collisions.
