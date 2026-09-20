# Desktop IPC & React State Hooks

This document details the Tauri IPC commands, WebSocket streaming hooks, and client-side state persistence in the **Krypton** desktop application.

---

## 1. Tauri Native IPC Command Reference

The Rust backend exposes native desktop commands registered in `apps/desktop/src-tauri/src/lib.rs`:

| Command | Rust File | Functionality |
| :--- | :--- | :--- |
| `get_krypton_paths` | `paths.rs` | Resolves canonical paths (`home`, `worktrees`, `cache`, `bin`). |
| `spawn_daemon` / `stop_daemon` | `sidecar.rs` | Controls the background sidecar daemon child process. |
| `ping_daemon` / `get_daemon_status` | `sidecar.rs` | Returns daemon running state, uptime, and socket path. |
| `toggle_synapse` / `show_synapse` / `toggle_overlay` | `overlay.rs` | Manipulates floating Krypton Synapse window visibility. |
| `window_minimize` / `window_toggle_maximize` / `window_close` | `window.rs` | Native window geometry management. |
| `start_audio_capture` / `stop_audio_capture` | `audio.rs` | Captures microphone input for local speech-to-text. |
| `check_setup_status` / `save_setup_configuration` | `setup.rs` | Inspects and writes initial onboarding configuration. |
| `install_cli_to_path` | `installer.rs` | Registers `krypton` CLI executable to the host system PATH. |
| `create_backup_vault` / `select_backup_save_dialog` | `maintenance.rs` | Aggregates workspaces and creates timestamped PKWARE ZIP archive. |
| `purge_app_data_and_reset` | `maintenance.rs` | Gracefully stops daemons and purges all local platform data. |
| `trigger_app_uninstall` | `maintenance.rs` | Spawns detached OS uninstaller script (`uninstall.ps1` / `uninstall.sh`). |
| `get_storage_paths_info` | `maintenance.rs` | Calculates cross-platform storage locations and byte footprints. |

---

## 2. Core React Communication Hooks

### A. `useKryptonDaemon.ts`
Manages the real-time WebSocket connection to `ws://127.0.0.1:19840` (`DEFAULT_WS_PORT`):
- **Auto-Reconnection**: Reconnects with exponential backoff if the daemon restarts.
- **RPC Invocation**: Exposes typed `callRpc<T>(method, params)` wrapper.
- **Real-Time Stream Parsing**: Listens for incoming WebSocket frames:
  - `token_stream`: Appends streaming LLM tokens to active message cards.
  - `agent_log`: Emits formatted debug logs into the console and outputs drawer.
  - `task_tree_updated`: Synchronizes live Todo DAG states.
  - `clarification_requested`: Triggers the HITL QuestionModal dialog.
  - `tool_approval_requested`: Intercepts sensitive commands and displays dynamic approval gates.
  - `tool_execution`: Injects real tool execution results into message cards.

### B. `useAgentSession.ts`
Coordinates active agent conversation state and the live IPC streaming pipeline:
- **Zero Mock Payloads**: Connected directly to the live `krypton-daemon` runtime without client-side simulated loops or mock AST responses.
- **Reactive State Machine**:
  - `Input`: Dispatches `startTask` with `{ prompt, agentName, model, provider, workspacePath, conversationHistory, askForApproval }`.
  - `Streaming Chunks`: Consumes live `token_stream` frames and accumulates assistant text with typing indicators.
  - `Dynamic Tool Approval Cards`: Daemon broadcasts `tool_approval_requested` when an action requires human review, pausing runtime execution.
  - `Approval Resolution`: Invoking `resolveMessageApproval(messageId, approved)` dispatches `{ method: "resolveApproval", params: { approvalId, approved } }` back to the daemon's paused Promise.
  - `Execution Complete`: Closes stream, marks thread completed, and finalizes thought trace steps.
- **Persistence**: Synchronizes workspaces, active thread, model choice, and approvals with localStorage via `lib/persistence.ts`.

### C. `useSynapse.ts` (and `useVoiceHud.ts` compatibility alias)
Controls voice recording and speech transcription:
- Manages offline PCM audio stream acquisition and Web Audio analyzer.
- Listens for `synapse:transcription` events broadcast across windows.
- Dispatches transcribed instructions to the selected target agent.
- `useVoiceHud.ts` is maintained as a transparent backward-compatible alias.

---

## 3. Client State Persistence (`lib/persistence.ts`)

To ensure smooth resumption between application launches, Krypton persists active workstation preferences:
- `activeProjectId`: Current selected project directory.
- `collapsedSidebar`: Sidebar visibility state.
- `activeDrawerTab`: Active tab in the bottom outputs drawer (`terminal`, `diff`, `tasks`, `logs`).
- `recentPrompts`: History of recent user inputs for quick recall.
