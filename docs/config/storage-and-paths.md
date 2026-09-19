# Storage, Platform Data Paths & Purge Boundaries

This document defines the cross-platform directory layout, storage locations, application data directories, and safe purge boundaries for **Krypton**.

---

## 1. Cross-Platform Directory Architecture

Krypton operates with local-first persistence across all supported operating systems. Application data is segregated into primary user configuration, native desktop caches, and platform lifecycle descriptors:

| Purpose | Windows | macOS | Linux |
| :--- | :--- | :--- | :--- |
| **Primary Runtime (`home`)** | `%USERPROFILE%\.krypton\` | `$HOME/.krypton/` | `$HOME/.krypton/` |
| **App Support / Roaming** | `%APPDATA%\krypton\` | `~/Library/Application Support/krypton/` | `~/.config/krypton/` or `$XDG_CONFIG_HOME/krypton` |
| **Local Cache / WebView2** | `%LOCALAPPDATA%\krypton\` | `~/Library/Caches/krypton/` | `~/.cache/krypton/` or `$XDG_CACHE_HOME/krypton` |
| **Preferences / State** | Registry / LocalAppData | `~/Library/Preferences/com.krypton.desktop.plist` | `~/.local/share/krypton/` or `$XDG_DATA_HOME` |
| **Autostart / Daemons** | Startup Registry / Service | `~/Library/LaunchAgents/com.krypton.daemon.plist` | `~/.config/systemd/user/krypton-daemon.service` |
| **Desktop Integrations** | Start Menu Shortcut & Registry | `/Applications/krypton.app` | `~/.local/share/applications/krypton.desktop` |

---

## 2. Primary Runtime Structure (`~/.krypton/`)

The primary runtime root contains all agent workspaces, configuration schemas, memory banks, task DAG logs, and execution scratchpads:

```
~/.krypton/
├── config.json                     # Global runtime configuration & model routing
├── credentials.json / .enc         # Local / AES-256-GCM encrypted provider credentials
├── models_cache.json               # Dynamically discovered provider models cache
├── bin/                            # Embedded standalone CLI executables
│   └── krypton.exe / krypton
├── agents/                         # Agent workspace directories
│   ├── default/
│   │   ├── config.json             # Agent-specific machine configuration
│   │   ├── IDENTITY.md             # Persona & operational directives
│   │   ├── SOUL.md                 # Core truths & behavioral boundaries
│   │   ├── AGENTS.md               # Operating rules & local conventions
│   │   ├── USER.md                 # User profile facts & durable preferences
│   │   ├── MEMORY.md               # Curated long-term lessons learned
│   │   ├── TODO.md                 # Dynamic task DAG ledger & history log
│   │   └── short_term/             # Event sourcing & session trajectories
│   │       ├── events.jsonl
│   │       └── trajectories/
│   └── <custom-agent>/
├── worktrees/                      # Isolated Git worktrees for autonomous tasks
│   └── <task-id>/
├── cache/
│   └── outputs/                    # Offloaded stdout logs (>1,500 tokens)
├── pty_sessions/                   # Persistent terminal logs & socket buffers
├── browser_profiles/               # Persistent browser profiles & cookies
│   ├── default/
│   └── whatsapp/
├── sandbox_workspace/              # Ephemeral script execution environments
└── logs/                           # Daemon & supervisor runtime diagnostics
```

---

## 3. Storage Inspection API

Storage path detection is unified across runtime and desktop layers:

### A. TypeScript Runtime (`packages/agent-runtime/src/vault/backup-engine.ts`)
`detectPlatformStoragePaths()` returns a normalized `StoragePathsInfo` structure:
- `primaryDir`: Canonical `~/.krypton` runtime path.
- `appDataDir`: Roaming application data path.
- `localAppDataDir`: Local cache/WebView2 data path.
- `platformPaths`: OS-specific system descriptor and preference locations.
- `diskUsageBytes`: Total combined storage utilization across all krypton directories.

### B. Tauri Desktop IPC (`apps/desktop/src-tauri/src/commands/maintenance.rs`)
Invoking Tauri command `get_storage_paths_info` returns the live platform paths and disk footprint to the frontend UI (`KryptonSettings.tsx`), providing real-time visibility into local resource usage.

---

## 4. Safe Purge Boundaries & Guardrails

The factory reset engine (`purgeAllKryptonData` / `purge_app_data_and_reset`) implements strict security constraints to prevent unintentional filesystem damage:

### A. Process Supervision & Lock Releasing
Before any filesystem deletion is attempted:
1. Active background daemons and supervisor child processes receive `SIGTERM` / `SIGINT`.
2. A 5-second graceful shutdown window permits SQLite transactions to commit and socket file descriptors (`krypton.sock`) to close.
3. If processes do not terminate within the grace window, ungraceful termination (`SIGKILL` / Windows `taskkill /F`) is applied to release Windows file locks.

### B. Deletion Boundary Checks
1. **Name Matching Verification**: Only directories whose path ends in `.krypton`, `krypton`, or `com.krypton.*` are candidates for deletion. Root directories (`/`, `C:\`, `/Users`, `C:\Users\<User>`) are explicitly rejected.
2. **Symlink Escape Protection**: Symbolic links and directory junctions are not recursively followed outside the krypton tree.
3. **Double-Confirmation Shield**: In the UI, purging requires explicit entry of the uppercase confirmation token `"RESET"` to prevent accidental triggering.
