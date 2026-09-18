# Storage Schemas & Filesystem Layout

This document specifies the cross-platform directory structure, storage locations, cache paths, and filesystem permissions for **Krypton**.

---

## 1. Cross-Platform Root Directory Resolution

Krypton adheres strictly to local-first principles. All runtime state, credentials, configurations, and worktrees reside within an OS-native user directory:

| Operating System | Canonical Runtime Directory | Resolved Path |
| :--- | :--- | :--- |
| **Windows** | `%USERPROFILE%\.krypton\` | `C:\Users\<Username>\.krypton\` |
| **macOS** | `$HOME/.krypton/` | `/Users/<username>/.krypton/` |
| **Linux** | `$HOME/.krypton/` | `/home/<username>/.krypton/` |

Path resolution is centralized in `packages/agent-runtime/src/filesystem/bootstrap.ts` and `apps/desktop/src-tauri/src/paths.rs`.

---

## 2. Directory Hierarchy Map

```
~/.krypton/
├── config.json                     # Global runtime configuration & model routing
├── credentials.enc                 # AES-256-GCM encrypted provider credentials
├── bin/                            # Embedded standalone CLI executables
│   └── krypton.exe / krypton
├── agents/                         # Agent workspace directories
│   ├── default/
│   │   ├── config.json             # Agent-specific machine configuration
│   │   ├── IDENTITY.md             # Persona & directives (pure markdown)
│   │   ├── SOUL.md                 # Core truths & behavioral boundaries
│   │   ├── AGENTS.md               # Operating rules & local notes
│   │   ├── USER.md                 # User profile facts & durable preferences
│   │   ├── MEMORY.md               # Curated long-term lessons learned
│   │   ├── TODO.md                 # Dynamic task DAG ledger & history log
│   │   └── short_term/             # Event sourcing & session trajectories
│   │       ├── events.jsonl
│   │       └── trajectories/
│   └── <custom-agent>/
├── worktrees/                      # Isolated Git worktrees for coding tasks
│   └── <task-id>/
├── cache/
│   └── outputs/                    # Offloaded stdout logs (>1,500 tokens)
├── pty_sessions/                   # Persistent terminal logs & socket buffers
├── browser_profiles/               # Persistent cookies & local storage
│   ├── default/
│   └── whatsapp/
├── sandbox_workspace/              # Ephemeral script execution environments
└── logs/                           # Daemon & supervisor runtime diagnostics
```

---

## 3. Global Configuration Schema (`~/.krypton/config.json`)

The global configuration conforms to `SystemConfigSchema` (`packages/shared-types/src/config.ts`):

```json
{
  "version": "1.0.0",
  "isInitialized": true,
  "defaultModel": "5.6 Terra High",
  "activeProvider": "anthropic",
  "defaultWorkspace": "C:\\Users\\user\\Projects",
  "hotkey": "CommandOrControl+Shift+Space",
  "port": 18789,
  "telemetry": false,
  "security": {
    "astLinter": true,
    "requireApproval": true
  }
}
```
