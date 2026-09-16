# Implementation Plan — Phase 5: Desktop App Shell & Micro-HUD

Implement the complete Phase 5 desktop runtime layer for Krypton, combining a multi-window **Tauri v2 (Rust)** application shell with a high-performance **React 19 / Next.js** dashboard, an always-on-top transparent floating **Voice Micro-HUD**, and the autonomous context-staging **Desktop Chatbar** per specification.

## User Review Required

> [!IMPORTANT]
> **Multi-Window Tauri Routing**: The application defines two decoupled windows in `tauri.conf.json`:
> 1. `main`: Full workspace dashboard rendering at `/dashboard` (min 960x640, default 1280x840).
> 2. `overlay`: Frameless, transparent floating Voice Micro-HUD rendering at `/overlay` (640x130, always-on-top, centered above cursor, toggled via `CommandOrControl+Shift+Space`).
> In browser development mode (`next dev`), both `/dashboard` and `/overlay` are accessible directly via URL routes.

> [!NOTE]
> **Dual-Mode IPC Bridge**: `useKryptonDaemon` and `useVoiceHud` will detect the Tauri environment via `@tauri-apps/api/core`'s `isTauri()`. When running inside Tauri, they invoke native Rust IPC commands (`spawn_daemon`, `toggle_overlay`, `start_audio_capture`, etc.) and listen to Tauri window events. When running outside Tauri (browser preview / Next.js tests), they gracefully fall back to local WebSocket connections (`ws://localhost:19840`) with rich mock simulation fixtures so UI development and tests can run reliably in any environment.

## Design Philosophy & Skill Adherence

Per user instructions, UI components and design must strictly adhere to:
1. **/shadcn**:
   - Built on top of the installed `@base-ui/react` primitives and `cn` utility matching the project's `base-vega` configuration.
   - Semantic tokens (`bg-background`, `text-muted-foreground`, `bg-primary`, `border-border`).
   - No `space-x-*`/`space-y-*` (use `flex flex-col gap-*`).
   - Proper composition (`asChild` / `render`, `FieldGroup`, `Badge`, `Button` variants, `DialogTitle`).
2. **/ui-ux-pro-max**:
   - Dark-mode first Nova aesthetic (zinc-900/zinc-950 backdrop, violet `#8B5CF6` affirmative accent).
   - Glassmorphism: `backdrop-blur-xl`, `border-zinc-800`, subtle ambient drop shadows.
   - Fixed 24px viewBox Lucide icons (`lucide-react` exclusively, zero emojis as UI icons).
   - Cursor pointer and smooth visual transitions on all clickable/interactive cards and elements.
3. **/hallmark**:
   - Anti-AI-slop structural variety and honest copy (no fabricated stats, no fake AI summaries, no fake mock browser chrome).
   - 8-state interactive design (default, hover, focus-visible, active, disabled, loading, error, success).
   - Strict mobile/desktop responsiveness, display headers with `overflow-wrap: anywhere`, no layout-shifting hover states.
4. **Krypton Desktop Chatbar RFC (`.idea/Krypton Desktop Chatbar.md`)**:
   - Floating pill bottom-anchored, smart paste ingestion (>=10 newlines or >=300 chars becomes a staged snippet chip), dynamic textarea growth clamped at 192px (`max-h-48`), autocomplete for `/` tools and `@` context, hover inspection displaying real lines/schemas, and reactive audio visualizer.

---

## Proposed Changes

### 1. Monorepo Configuration & Shared Contracts

#### [MODIFY] [package.json](file:///e:/all%20my%20code/krypton/apps/desktop/package.json)
- Add `"@krypton/shared-types": "workspace:*"` to dependencies so the desktop frontend has direct, zero-drift access to `TaskNode`, `TaskTree`, `ClarificationRequest`, `ClarificationResponse`, `AgentContext`, `VoiceTranscribedEvent`, `KryptonChatPayload`, etc.

---

### 2. Tauri v2 Rust Shell & Multi-Window Architecture (`apps/desktop/src-tauri`)

#### [MODIFY] [tauri.conf.json](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/tauri.conf.json)
- Configure multi-window array:
  - `main`: Dashboard window (`title: "Krypton"`, 1280x840, resizable, minWidth 960, minHeight 640).
  - `overlay`: Floating Voice Micro-HUD (`title: "Krypton Voice HUD"`, url `/overlay`, 640x130, `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `visible: false`).
- Declare external sidecar binary: `"externalBin": ["binaries/krypton-daemon"]`.
- Bundle icons and app identifier.

#### [MODIFY] [capabilities/default.json](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/capabilities/default.json)
- Authorize permissions for both `main` and `overlay` windows with `core:default`.

#### [NEW] [paths.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/paths.rs)
- Resolve `%USERPROFILE%\.krypton` on Windows and `$HOME/.krypton` on POSIX.
- Implement directory verification and scaffolding for `cache/outputs`, `pty_sessions`, `agents`, `worktrees`, `logs`.
- Expose Tauri command `get_krypton_paths` returning verified paths and permissions status.

#### [NEW] [commands/sidecar.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/commands/sidecar.rs)
- Implement `DaemonSupervisor`:
  - Manage spawning of `krypton-daemon` child process (with fallback to `node/bun` script in development mode).
  - Monitor daemon stdout/stderr and health check ping.
  - Graceful termination: kill process tree on app shutdown to prevent orphan processes.
  - Expose Tauri commands: `spawn_daemon`, `stop_daemon`, `get_daemon_status`, `ping_daemon`.

#### [NEW] [commands/hotkey.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/commands/hotkey.rs)
- Global shortcut manager registering `CommandOrControl+Shift+Space`.
- Handle hotkey trigger to toggle the floating Voice Micro-HUD overlay window.
- Expose Tauri command `toggle_overlay`.

#### [NEW] [overlay.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/overlay.rs)
- Floating window positioning controller:
  - Center overlay dynamically on active monitor / display.
  - Toggle window visibility (`show()`, `hide()`, `set_focus()`).
  - Expose Tauri commands: `show_overlay`, `hide_overlay`.

#### [NEW] [commands/audio.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/commands/audio.rs)
- Audio capture and speech-to-text bridge:
  - Microphone capture state management.
  - Transcribe bridge abstraction supporting local Parakeet v3 / Whisper and cloud Whisper API fallback.
  - Event streaming: emits `VoiceTranscribedEvent` to frontend and daemon steering queue.
  - Expose Tauri commands: `start_audio_capture`, `stop_audio_capture`, `get_audio_status`.

#### [NEW] [commands/mod.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/commands/mod.rs)
- Centralized export for all Tauri command handlers.

#### [MODIFY] [lib.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/lib.rs)
- Wire invoke handlers: `get_krypton_paths`, `spawn_daemon`, `stop_daemon`, `get_daemon_status`, `ping_daemon`, `toggle_overlay`, `show_overlay`, `hide_overlay`, `start_audio_capture`, `stop_audio_capture`, `get_audio_status`, `submit_chat_turn`.
- Setup system tray icon with quick actions:
  - "Show Dashboard"
  - "Toggle Voice HUD"
  - "Stop Active Agents"
  - "Quit Krypton"

---

### 3. Shadcn UI Components (`apps/desktop/src/components/ui`)

#### [NEW] [card.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/ui/card.tsx)
- Full card composition: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` using `base-vega` zinc styles.

#### [NEW] [tabs.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/ui/tabs.tsx)
- Accessible tabs: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` using `@base-ui/react/tabs`.

#### [NEW] [separator.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/ui/separator.tsx)
- Semantic horizontal/vertical separator using `@base-ui/react/separator`.

#### [NEW] [input.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/ui/input.tsx)
- Accessible styled input using `@base-ui/react/input` with focus rings and invalid states.

---

### 4. Desktop Chatbar (`apps/desktop/src/components/chatbar/`)

#### [NEW] [useChatbarState.ts](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/chatbar/useChatbarState.ts)
- Custom state hook implementing the Chatbar state machine:
  - Dynamic textarea height calculation clamped between 24px and 192px (`max-h-48`).
  - Smart paste ingestion: cancels native paste and creates staged snippet chip when text has $\ge 10$ newlines or $\ge 300$ characters.
  - Autocomplete trigger parsing: detects leading `/` (tools/actions) and `@` (workspace files/context) preceding cursor.
  - Context staging tray management (adding/removing files, snippets, MCP tools, skills).
  - Web Audio API integration for microphone recording and reactive volume metering.
  - Payload serialization strictly conforming to `KryptonChatPayload`.

#### [NEW] [AttachmentTray.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/chatbar/AttachmentTray.tsx)
- Horizontal flexbox tray with custom scroll styling.
- Renders staged context chips with entity type icon (`FileCode`, `FileText`, `Wrench`, `Sparkles`), label, metadata pill (`124 lines`, `4.2 KB`), and remove button.
- Triggers hover preview after 200ms.

#### [NEW] [HoverPreviewCard.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/chatbar/HoverPreviewCard.tsx)
- Floating popover showing real textual lines (first 10 lines) with monospace styling or verified MCP tool description. Zero fabricated AI summary cards.

#### [NEW] [CommandMenu.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/chatbar/CommandMenu.tsx)
- Floating popover anchored above chatbar.
- Keyboard navigable (`ArrowDown`, `ArrowUp`, `Enter`, `Tab`, `Escape`) for filtered lists of tools (`/`) and workspace files/agents (`@`).

#### [NEW] [AudioWaveform.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/chatbar/AudioWaveform.tsx)
- Reactive recording pill with 4 vertical scaling bars (4px to 20px) driven by live PCM decibel amplitude.

#### [NEW] [Chatbar.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/chatbar/Chatbar.tsx)
- Floating pill anchored at bottom-center of the dashboard.
- Dark backdrop (`zinc-900/90`), `backdrop-blur-xl`, `border-zinc-800`, `shadow-2xl`.
- Three vertically stacked regions: AttachmentTray, Text Processing Surface, and Action & Execution Toolbar.

---

### 5. Core Dashboard & Overlay Components (`apps/desktop/src/components/`)

#### [NEW] [TodoTree.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/TodoTree.tsx)
- Interactive Task DAG visualizer:
  - Visual status badges (`pending`, `in_progress`, `completed`, `failed`, `blocked`).
  - Dependency arrows/tree view, assigned agent tag, execution duration.
  - Visual pulse animation on newly inserted recovery tasks from dynamic replanning.

#### [NEW] [QuestionModal.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/QuestionModal.tsx)
- Accessible HITL clarification modal:
  - Option selector with numbered hotkey hints (`[1]`, `[2]`, `[3]`).
  - Arrow key navigation and Enter to confirm.
  - Freeform text response input field.
  - Timeout countdown indicator.

#### [NEW] [VcsDiffViewer.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/components/VcsDiffViewer.tsx)
- Visual Git worktree diff viewer:
  - Side-by-side or unified view with syntax highlighting for additions (`+`) and deletions (`-`).
  - Worktree branch badge (`krypton/<task-id>`) and base commit reference.
  - Action buttons: "Approve & Merge to Working Branch", "Rollback Step", "Reject & Abort".

---

### 6. Desktop Next.js Pages & Layouts (`apps/desktop/src/app/`)

#### [MODIFY] [globals.css](file:///e:/all%20my%20code/krypton/apps/desktop/src/app/globals.css)
- Enhance Nova dark-mode theme variables, custom scrollbars, glassmorphic utility classes, and audio bar animation keyframes.

#### [MODIFY] [layout.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/app/layout.tsx)
- Ensure persistent `dark` theme class, layout shell, and title "Krypton — Autonomous Desktop AI Agent Runtime".

#### [MODIFY] [page.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/app/page.tsx)
- Route root page to dashboard workspace.

#### [NEW] [dashboard/page.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/app/dashboard/page.tsx)
- Primary workspace dashboard:
  - Top header: Fleet status, live token spend pill (`14.2k / 100k`), active branch (`krypton/main`), Voice HUD toggle trigger, daemon status pill.
  - Left panel: Active Agent Fleet and recursive sub-agent hierarchy.
  - Center panel: Dynamic Todo DAG (`TodoTree`).
  - Right panel: Live Execution Logs & Trajectory Stream.
  - Floating bottom: Context-staging Chatbar with mid-flight prompt injection.
  - Modals: Integrated `QuestionModal` and `VcsDiffViewer`.

#### [NEW] [overlay/page.tsx](file:///e:/all%20my%20code/krypton/apps/desktop/src/app/overlay/page.tsx)
- Floating Voice Micro-HUD window:
  - Frameless, translucent Spotlight-style floating pill.
  - Real-time reactive waveform visualizer.
  - Target Agent Selector chip (`[Orchestrator]`, `[Coder]`, `[Scraper]`).
  - Live streaming transcription text preview.
  - Push-to-talk recording controls and quick status pill.

---

### 7. Frontend State Management & Hooks (`apps/desktop/src/hooks/`)

#### [NEW] [useKryptonDaemon.ts](file:///e:/all%20my%20code/krypton/apps/desktop/src/hooks/useKryptonDaemon.ts)
- Persistent connection to daemon over Tauri IPC or WebSocket.
- Synchronizes agent state, active task DAG, token spend, log events, and incoming `ClarificationRequest` packets.
- Provides dispatch functions: `submitChatTurn`, `respondClarification`, `approveMerge`, `rollbackStep`.

#### [NEW] [useVoiceHud.ts](file:///e:/all%20my%20code/krypton/apps/desktop/src/hooks/useVoiceHud.ts)
- Push-to-talk audio recording, Web Audio API amplitude meter, streaming transcription state, and prompt dispatch to selected agent.

---

### 8. Verification & Tests

#### [NEW] [apps/desktop/__tests__/chatbar.test.ts](file:///e:/all%20my%20code/krypton/apps/desktop/__tests__/chatbar.test.ts)
- Unit tests for Chatbar logic:
  - Smart paste ingestion: verifies $\ge 10$ newlines and $\ge 300$ chars trigger snippet staging and prevents raw paste dump.
  - Autocomplete trigger parsing: `/` triggers tools, `@` triggers context.
  - Payload serialization conforms to `KryptonChatPayload`.

#### [NEW] [apps/desktop/__tests__/smoke.test.ts](file:///e:/all%20my%20code/krypton/apps/desktop/__tests__/smoke.test.ts)
- Integration smoke tests verifying:
  - Multi-window configuration integrity in `tauri.conf.json`.
  - Path resolver and command schemas.
  - State hook event parsing and serialization.

---

## Verification Plan

### Automated Tests
1. **Rust Backend Check**:
   ```powershell
   cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
   ```
   Must pass with 0 errors.

2. **Shared Types & Typecheck**:
   ```powershell
   pnpm --filter @krypton/shared-types build
   ```

3. **Desktop Frontend Build**:
   ```powershell
   pnpm --filter desktop build
   ```
   Must compile Next.js production bundle with 0 errors, validating all pages (`/`, `/dashboard`, `/overlay`).

4. **Desktop Test Suite**:
   ```powershell
   pnpm test
   ```
   Run automated test suite for chatbar, smoke, and component behavior.

### Manual Verification
- Verify that both `/dashboard` and `/overlay` routes render beautifully in dark-mode with zero visual glitches.
- Test Chatbar paste interception with multi-line snippet.
- Check off completed tasks in `.idea/TODO.md`.
