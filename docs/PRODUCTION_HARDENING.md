# Krypton Production Architecture Hardening & First-Run Setup Engine

This document details the production hardening refactors applied to the **Krypton** desktop application, covering frameless window unification, native IPC management, pure state sanitization, and the automated first-run setup onboarding engine.

---

## 1. Unified Frameless Window Architecture

To achieve an ultra-premium, native desktop appearance without visual clutter, Krypton enforces a single-titlebar frameless design across Windows, macOS, and Linux.

### OS Native Chrome Suppression (`tauri.conf.json`)
The native OS window decorations (system titlebar and double borders) are suppressed for the primary workstation window:
```json
{
  "label": "main",
  "title": "Krypton",
  "width": 1280,
  "height": 840,
  "minWidth": 960,
  "minHeight": 640,
  "resizable": true,
  "fullscreen": false,
  "decorations": false
}
```

### Draggable Header Region & Button Click Isolation
- The internal window header (`WindowHeader.tsx`) is tagged with `data-tauri-drag-region`, enabling smooth multi-monitor window movement.
- All interactive controls (menus, history buttons, drawer toggles, and window action buttons) explicitly define `data-tauri-drag-region="false"` and `pointer-events-auto`, preventing accidental drag operations when clicking.

### Native Window Management IPC Commands
All window lifecycle events are bridged to native Tauri APIs in `apps/desktop/src-tauri/src/commands/window.rs`:

| Command | Signature | Function |
| :--- | :--- | :--- |
| `window_minimize` | `(window: WebviewWindow) -> Result<(), String>` | Minimizes the active window to the taskbar/dock. |
| `window_toggle_maximize` | `(window: WebviewWindow) -> Result<bool, String>` | Toggles between maximized and restored states. |
| `window_close` | `(window: WebviewWindow) -> Result<(), String>` | Closes the application gracefully. |
| `window_is_maximized` | `(window: WebviewWindow) -> Result<bool, String>` | Queries whether the window is currently maximized. |

The internal titlebar dynamically updates its icon between `Square` (maximize) and `Copy` (restore) based on real-time window metrics.

---

## 2. Mock Data Purge & Clean State Architecture

All hardcoded UI artifacts and mock objects leftover from design screenshot references have been purged:

1. **Clean Workstation State (`DEFAULT_INITIAL_STATE`)**:
   - `projects: []`: No pre-seeded fake projects (`proj-krypton`, `clash-bot-engine`) or fake chat histories (`thread-welcome-01`).
   - Pure empty state rendering: If unpopulated, Krypton presents an inviting empty-workstation hero prompting the user to create or open a project workspace.
   - Dynamic prompt suggestions are tied to functional agent operations (AST validation, worktree task DAG synthesis, dependency inspection).

2. **Quota & Subscription Overlays Removed**:
   - Completely deleted mock token usage meters, quota usage cards, and upgrade banners (`QuotaBanner.tsx`). Krypton is a self-contained local-first runtime and does not display subscription banners.

3. **Mock User Profile Removed**:
   - Removed the mock profile avatar (`razin-khan`), tier indicator, and token counters from the sidebar.
   - Replaced with a sleek runtime status footer indicating daemon health (`krypton-daemon: active`) and local version without empty gaps.

---

## 3. First-Run Setup Engine & Onboarding Flow

Krypton includes an automated, cross-platform onboarding lifecycle that ensures the host environment is properly configured before entering the workstation.

### Lifecycle Detection Flow

```
Application Boot
      │
      ▼
Invoke `check_setup_status` (Rust Tauri command)
      │
      ├─► Does `~/.krypton/config.json` exist with `isInitialized: true`?
      │        │
      │        ├─► YES: Load active workspaces & render Workstation Shell
      │        │
      │        └─► NO: Flag as First-Run Session
      │                 │
      │                 ▼
      └─────────► Render `FirstRunSetupWizard`
```

### Setup Wizard Steps (`FirstRunSetupWizard.tsx`)

1. **Agent Identity & Persona**:
   - Configure supervisor name (default: `Orchestrator`).
   - Define agent role & system directives.
   - Select reasoning style (Strict & Analytical / Autonomous Agile / Research & Synthesis).

2. **Model Routing & API Credentials**:
   - Select primary reasoning model (`5.6 Terra High`, `Claude 3.7 Sonnet`, `GPT-4o`, `DeepSeek R1`, `Local Llama 3.3`).
   - Provide optional Anthropic or OpenAI API keys with local AES-256-GCM encryption.
   - Support local OpenAI-compatible endpoints (Ollama / vLLM).

3. **Workspace Storage**:
   - Configure the root workspace directory (defaulting to OS-native `%USERPROFILE%\Projects` or `$HOME/projects`).
   - Setup initial project workspace name.

4. **Security Guardrails & Runtime Preferences**:
   - Human-in-the-Loop (HITL) prompt approvals toggle.
   - Static AST Safety Linter enforcement toggle.
   - Anonymous telemetry opt-in toggle (disabled by default).

### Native Configuration Persistence (`save_setup_configuration`)

When the wizard is submitted:
1. Validates schema inputs against `@krypton/shared-types`.
2. Creates `%USERPROFILE%\.krypton\` (or `$HOME/.krypton/`) folder tree.
3. Writes `config.json` with `isInitialized: true`, custom agent name, default workspace path, and route mappings.
4. Encrypts and writes API keys to `~/.krypton/credentials.json` / `credentials.enc`.
5. Scaffolds initial agent manifests in `~/.krypton/agents/<agentName>/` (`IDENTITY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`).
6. Updates workstation state immediately, transitioning smoothly to the primary workspace without application restarts.

---

## 4. Application Menus & Navigation History

- **Interactive Menus**: File, Edit, View, and Help dropdowns with keyboard shortcuts (`Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+B`, `Ctrl+J`, `Ctrl+,`).
- **Preferences & Reconfiguration**: Users can re-launch the setup wizard anytime via `File -> Setup Wizard...` or `Edit -> Preferences...`.
- **Navigation History**: Back and Forward buttons track visited project workspaces and chat sessions, enabling smooth chronological navigation.
