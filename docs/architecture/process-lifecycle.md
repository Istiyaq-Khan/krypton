# Process Lifecycle & Supervisor Architecture

This document describes the application boot sequence, runtime supervisor mechanics, child process management, and clean termination protocols in **Krypton**.

---

## 1. Application Startup Sequence

When the user launches the Krypton desktop application, the runtime executes the following sequence:

```
[1. Desktop Binary Launch (krypton.exe / Krypton.app)]
                 │
                 ▼
[2. Tauri Rust Backend Initialization (`lib.rs`)]
   ├─► Log plugin initialization
   ├─► `ensure_krypton_directories()` verifies/creates `~/.krypton/` tree
   └─► Window creation: `main` (hidden until setup check) & `overlay`
                 │
                 ▼
[3. First-Run Setup Inspection (`check_setup_status`)]
   ├─► If `~/.krypton/config.json` exists & `isInitialized: true`:
   │     └─► Reveal primary workstation dashboard (`/dashboard`)
   └─► If NOT initialized:
         └─► Present `FirstRunSetupWizard` modal
                 │
                 ▼
[4. Sidecar Daemon Supervisor Activation (`spawn_daemon`)]
   ├─► Locate daemon binary across candidate search paths
   ├─► Spawn child process `krypton-daemon`
   └─► Begin periodic health ping checks over IPC
                 │
                 ▼
[5. Frontend Client Connection (`useKryptonDaemon`)]
   ├─► Connect to WebSocket at `ws://127.0.0.1:18789`
   ├─► Fetch active agent list (`listAgents`)
   └─► Rehydrate active task DAGs & stream events
```

---

## 2. Sidecar Daemon Candidate Discovery

The Rust sidecar supervisor (`apps/desktop/src-tauri/src/commands/sidecar.rs`) discovers the `krypton-daemon` executable through prioritized search locations:

```rust
// Discovery Priority Order:
1. Application Parent Directory: std::env::current_exe().parent()
2. Bundle Resources Directory:   ../Resources/binaries/ (macOS .app)
3. AppImage Mount Environment:   $APPDIR/usr/bin/ (Linux AppImage)
4. User Home Binary Directory:   ~/.krypton/bin/
5. Development Workspace Source: ../../packages/agent-runtime/dist/daemon.js
```

If the compiled binary is not found during development, the supervisor automatically falls back to invoking `node` with the built TypeScript daemon script.

---

## 3. Window Lifecycle & Management

The desktop shell manages two dedicated native windows declared in `tauri.conf.json`:

| Window Label | Initial State | Dimensions | Properties | Role |
| :--- | :--- | :--- | :--- | :--- |
| `main` | Visible | 1280 × 840 (min 960 × 640) | Frameless, resizable | Primary interactive workspace & dashboard |
| `synapse` (or `overlay`) | Hidden | 640 × 130 | Frameless, transparent, always-on-top, skip-taskbar | Floating Krypton Synapse |

### Window Lifecycle Control Commands:
- `window_minimize`: Minimizes the main window to the OS taskbar/dock.
- `window_toggle_maximize`: Toggles between maximized screen estate and restored geometry.
- `window_close`: Initiates graceful application teardown.
- `toggle_synapse`: Toggles the visibility of the floating Krypton Synapse overlay via global hotkey (`Ctrl+Shift+Space`). `toggle_overlay` is preserved as an alias.

---

## 4. Teardown & Clean Termination Protocol

To avoid orphaned background processes and dangling browser instances, Krypton enforces a strict teardown cascade:

1. **Window Close Event**: Invoked when the main window receives a close signal or `Quit` is triggered from the system tray.
2. **Sidecar Process Termination**:
   - The supervisor issues a `SIGTERM` to `krypton-daemon`.
   - Waits up to 3,000ms for clean resource serialization (saving `events.jsonl` and committing open transaction logs).
   - If the process fails to exit, forcibly kills the entire process tree via `SIGKILL` (`killProcessTree` / Windows Job Object termination).
3. **Subprocess Cleanup**:
   - Running sandboxed scripts, Tree-sitter workers, and Chromium browser contexts are terminated.
   - Named pipes (`\\.\pipe\krypton-ipc`) and UNIX domain sockets (`/tmp/krypton.sock`) are unlinked.
