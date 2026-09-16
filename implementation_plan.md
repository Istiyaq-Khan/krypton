# Implementation Plan — Phase 6: Omni-Channel Gateway & Native Distribution

Complete the external communication bridge, native terminal client, single-binary sidecar compilation, and native distribution packaging for **Krypton**.

## User Review Required

> [!IMPORTANT]
> **Omni-Channel Architecture**: All channel adapters (Telegram, Discord, WhatsApp, Slack, Signal) normalize messages into universal Krypton message contracts and normalize outgoing Markdown to platform-specific formats (e.g. Telegram HTML `<b>`, WhatsApp `*bold*`, Slack Block Kit). Each adapter provides full mockable execution for headless tests and live production socket/client hooks.

> [!NOTE]
> **Ink CLI Engine (`krypton-cli`)**: Built with React + Ink and TypeScript. It communicates with the background daemon over the platform IPC pipe (Windows Named Pipe `\\.\pipe\krypton-ipc` or POSIX domain socket `/tmp/krypton.sock`) and WebSocket, rendering interactive task DAG spinners and arrow-key HITL clarification prompts.

---

## Proposed Changes

### 1. Multi-Platform Channel Adapters (`packages/agent-runtime/src/channels/`)

#### [NEW] [router.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/router.ts)
- `ChannelSessionRouter`:
  - Persistent routing table mapping `(channel, threadId, userId)` to target agent.
  - Normalizes incoming payloads (text, images, voice notes, documents) to universal `ChannelIncomingMessage`.
  - Normalizes outgoing markdown:
    - `toTelegramHtml(markdown: string): string`
    - `toWhatsAppMarkdown(markdown: string): string`
    - `toDiscordMarkdown(markdown: string): string`
    - `toSlackBlockKit(markdown: string): object`
    - `toSignalText(markdown: string): string`
  - Routes agent responses and HITL prompts back to originating channel.

#### [NEW] [telegram.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/telegram.ts)
- `TelegramChannelAdapter`:
  - Command handling: `/start`, `/run <instruction>`, `/status`, `/help`.
  - Thread-locking per autonomous task.
  - Inline keyboard buttons for HITL clarification requests (maps `ClarificationRequest.options` to inline buttons, handles callback queries).

#### [NEW] [discord.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/discord.ts)
- `DiscordChannelAdapter`:
  - Guild channel management and thread creation per task.
  - Interactive ActionRow button components for HITL prompts.

#### [NEW] [whatsapp.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/whatsapp.ts)
- `WhatsAppChannelAdapter`:
  - Baileys socket integration with persistent credentials stored in `~/.krypton/browser_profiles/whatsapp/`.
  - Numbered reply menus for mobile interaction (e.g. "Reply 1 for ..., Reply 2 for ...").

#### [NEW] [slack.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/slack.ts)
- `SlackChannelAdapter`:
  - Block Kit modals for user prompts and task DAG checklist updates.

#### [NEW] [signal.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/signal.ts)
- `SignalChannelAdapter`:
  - Wrap `signal-cli` JSON-RPC over stdio for end-to-end encrypted autonomous interaction.

#### [NEW] [index.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/channels/index.ts)
- Central export for all channel adapters.

#### [MODIFY] [index.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/index.ts)
- Export channels subsystem from agent runtime.

---

### 2. Standalone Terminal CLI Engine (`packages/cli/`)

#### [NEW] [package.json](file:///e:/all%20my%20code/krypton/packages/cli/package.json) & [tsconfig.json](file:///e:/all%20my%20code/krypton/packages/cli/tsconfig.json)
- Package configuration with dependencies: `@krypton/shared-types`, `ink`, `react`, `commander`.
- Bin entry: `"krypton": "./dist/index.js"`.

#### [NEW] [ipc-client.ts](file:///e:/all%20my%20code/krypton/packages/cli/src/ipc-client.ts)
- IPC client connecting to running `krypton-daemon` via platform pipe (`\\.\pipe\krypton-ipc` on Windows, `/tmp/krypton.sock` on Unix) or WebSocket.
- Auto-spawns daemon in headless mode if not currently active.

#### [NEW] [ui/TaskListView.tsx](file:///e:/all%20my%20code/krypton/packages/cli/src/ui/TaskListView.tsx)
- Terminal UI task list view rendering animated spinners, task DAG status symbols (`[✓]`, `[⟳]`, `[✗]`, `[·]`), and progress statistics.

#### [NEW] [ui/QuestionPrompt.tsx](file:///e:/all%20my%20code/krypton/packages/cli/src/ui/QuestionPrompt.tsx)
- Interactive terminal question prompter with arrow-key option navigation, hotkey hints (`1`..`9`), and custom text input.

#### [NEW] [commands/run.ts](file:///e:/all%20my%20code/krypton/packages/cli/src/commands/run.ts)
- `krypton run "<instruction>"`: Dispatches instruction to orchestrator agent and renders live Ink task progress.

#### [NEW] [commands/vcs.ts](file:///e:/all%20my%20code/krypton/packages/cli/src/commands/vcs.ts)
- `krypton vcs [diff|rollback|merge]`: Reviews diffs and confirms worktree merge/rollback.

#### [NEW] [commands/agents.ts](file:///e:/all%20my%20code/krypton/packages/cli/src/commands/agents.ts)
- `krypton agents [list|create|edit]`: Lists agent fleet and configs.

#### [NEW] [commands/tools.ts](file:///e:/all%20my%20code/krypton/packages/cli/src/commands/tools.ts)
- `krypton tools [list|test]`: Inspects registered MCP and synthesized tools.

#### [NEW] [index.ts](file:///e:/all%20my%20code/krypton/packages/cli/src/index.ts)
- Main CLI executable router with commander commands and help formatting.

#### [NEW] [installer.rs](file:///e:/all%20my%20code/krypton/apps/desktop/src-tauri/src/commands/installer.rs)
- Rust command `install_cli_to_path` automatically symlinking or adding `krypton` CLI binary into system PATH during desktop launch. Registered in `src-tauri/src/lib.rs`.

---

### 3. Standalone Binary Compilation & Sidecar Bundling (`scripts/`)

#### [NEW] [build-sidecar.mjs](file:///e:/all%20my%20code/krypton/scripts/build-sidecar.mjs)
- Standalone sidecar compiler script compiling `packages/agent-runtime` into target-specific single-binary executables under `apps/desktop/src-tauri/binaries/`:
  - `krypton-daemon-x86_64-pc-windows-msvc.exe`
  - `krypton-daemon-x86_64-apple-darwin`
  - `krypton-daemon-aarch64-apple-darwin`
  - `krypton-daemon-x86_64-unknown-linux-gnu`

#### [NEW] [build-cli.mjs](file:///e:/all%20my%20code/krypton/scripts/build-cli.mjs)
- Standalone CLI compiler compiling `packages/cli` into `krypton` / `krypton.exe`.

#### [NEW] [setup-env.mjs](file:///e:/all%20my%20code/krypton/scripts/setup-env.mjs)
- Prerequisites validator verifying Playwright, audio dependencies, Node/Bun, and Git.

---

### 4. Cross-Platform Native Packaging & CI Release Pipeline

#### [NEW] [release.yml](file:///e:/all%20my%20code/krypton/.github/workflows/release.yml)
- GitHub Actions matrix workflow across Windows, macOS Intel, macOS Apple Silicon, and Linux.
- Compiles sidecar, builds Next.js frontend assets, packages native bundles via `tauri build`.

#### [MODIFY] [bootstrap.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/src/filesystem/bootstrap.ts)
- Implement `ensureBrowserBinaries` to download lightweight Chromium binaries on-demand into `~/.krypton/browser_binaries` keeping the desktop installer under 100MB.

---

### 5. Verification & Tests

#### [NEW] [packages/agent-runtime/__tests__/channels.test.ts](file:///e:/all%20my%20code/krypton/packages/agent-runtime/__tests__/channels.test.ts)
- Comprehensive test suite validating:
  - ChannelSessionRouter thread session mapping.
  - Markdown normalizers for Telegram HTML, WhatsApp markdown, Discord markdown, Slack Block Kit, Signal.
  - Telegram, Discord, WhatsApp, Slack, Signal mock message dispatch and HITL clarification resolution.

---

## Verification Plan

### Automated Tests
1. **Channel Integration Test Suite**:
   ```powershell
   pnpm --filter @krypton/agent-runtime test __tests__/channels.test.ts
   ```
2. **CLI Build & Compilation**:
   ```powershell
   node scripts/build-cli.mjs
   node scripts/build-sidecar.mjs
   node scripts/setup-env.mjs
   ```
3. **Rust Backend Check**:
   ```powershell
   cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
   ```
4. **Desktop Frontend Build**:
   ```powershell
   pnpm --filter desktop build
   ```
5. **Full Monorepo Build & Test**:
   ```powershell
   pnpm --filter @krypton/shared-types test
   pnpm --filter @krypton/agent-runtime test
   pnpm --filter desktop test
   ```
