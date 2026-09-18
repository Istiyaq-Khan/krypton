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
| `toggle_overlay` / `show_overlay` | `overlay.rs` | Manipulates floating voice HUD window visibility. |
| `window_minimize` / `window_toggle_maximize` / `window_close` | `window.rs` | Native window geometry management. |
| `open_folder_dialog` | `window.rs` | Invokes native OS directory picker dialog and returns path. |
| `start_audio_capture` / `stop_audio_capture` | `audio.rs` | Captures microphone input for local speech-to-text. |
| `check_setup_status` / `save_setup_configuration` | `setup.rs` | Inspects and writes initial onboarding configuration. |
| `install_cli_to_path` | `installer.rs` | Registers `krypton` CLI executable to the host system PATH. |

---

## 2. Core React Communication Hooks

### A. `useKryptonDaemon.ts`
Manages the real-time WebSocket connection to `ws://127.0.0.1:18789`:
- **Auto-Reconnection**: Reconnects with exponential backoff if the daemon restarts.
- **RPC Invocation**: Exposes typed `callRpc<T>(method, params)` wrapper.
- **Real-Time Stream Parsing**: Listens for incoming WebSocket frames:
  - `token_stream`: Appends streaming LLM tokens to active message cards.
  - `agent_log`: Emits formatted debug logs into the console and outputs drawer.
  - `task_tree_updated`: Synchronizes live Todo DAG states.
  - `clarification_requested`: Triggers the HITL QuestionModal dialog.

### B. `useAgentSession.ts`
Coordinates active agent conversation state and workspaces:
- Tracks active task ID, messages array, and thought traces.
- Handles user message submission, prompt decomposition, and mid-flight cancellation.
- Manages workspace list, active project selection, and conversation threads.
- Exposes `openFolder(path?)` to trigger native folder picker (`open_folder_dialog`), auto-register projects, and switch workspaces seamlessly.
- Synchronizes with localStorage via `lib/persistence.ts`.

### C. `useVoiceHud.ts`
Controls voice recording and speech transcription:
- Manages push-to-talk microphone state.
- Receives streaming partial and final transcription strings.
- Dispatches transcribed instructions to the selected target agent.

---

## 3. Client State Persistence (`lib/persistence.ts`)

To ensure smooth resumption between application launches, Krypton persists active workstation preferences:
- `activeProjectId`: Current selected project directory.
- `collapsedSidebar`: Sidebar visibility state.
- `activeDrawerTab`: Active tab in the bottom outputs drawer (`terminal`, `diff`, `tasks`, `logs`).
- `recentPrompts`: History of recent user inputs for quick recall.
