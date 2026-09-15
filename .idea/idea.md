**Krypton** is a local-first, cross-platform autonomous desktop AI runtime built on a hybrid Tauri v2 (Rust) shell and a TypeScript/Bun background daemon. It coordinates recursive actor-model sub-agents capable of ad-hoc Python/TypeScript tool synthesis, deterministic Git worktree version control, stealth accessibility-tree browser automation, and multi-channel synchronization (Telegram, Discord, WhatsApp, Slack, Signal). Featuring an always-on-top transparent voice HUD powered by Parakeet v3/Whisper, Krypton executes complex multi-step workflows with strict context compaction, mid-flight steering, and native OS secret vault security.

A local-first, cross-platform desktop AI agent runtime with recursive sub-agents, dynamic code sandboxing, stealth browser automation, voice HUD, and multi-channel sync.

### System Topology & Core Stack

```
                     ┌─────────────────────────────────────────────────────────┐
                     │                   OS Native Shell                       │
                     │          Tauri v2 Core (Rust Architecture)              │
                     │  - Global Shortcuts  - System Tray  - Native Keyring    │
                     └───────────────┬─────────────────────────┬───────────────┘
                                     │                         │
           ┌────────────────────────▼───────┐ ┌───────────────▼────────────────────────┐
           │       Main Application         │ │       Floating Voice Micro-HUD         │
           │   (React / Next.js / Tailwind) │ │   (Always-on-top, Spotlight-style)     │
           └────────────────┬───────────────┘ └───────────────┬────────────────────────┘
                             │  IPC / WebSockets (Internal)    │
                             └───────────────┬─────────────────┘
                                             │
       ┌─────────────────────────────────────────▼─────────────────────────────────────────┐
       │                    Unified Agent Runtime Engine (Node.js/Bun)                     │
       ├───────────────────────────────┬───────────────────────────┬───────────────────────┤
       │     Fractal Agent Engine      │     Provider Gateway      │    Channel Gateway    │
       │  - Actor-Model Sub-Agents     │  - OpenAI Format          │  - Telegram / Discord │
       │  - Memory & State Manager     │  - Anthropic Format       │  - WhatsApp / Slack   │
       │  - Task Queue & Event Bus     │  - Keyring Secret Vault   │  - Signal Protocol    │
       └───────────────┬───────────────┴─────────────┬─────────────┴───────────────┬───────┘
                       │                             │                             │
       ┌───────────────▼───────────────┐ ┌───────────▼─────────────┐ ┌─────────────▼───────┐
       │  Stealth Browser Automation   │ │   MCP Client Manager    │ │  Dynamic Sandbox    │
       │  - Playwright / CDP Core      │ │  - Stdio Transport      │ │  - Python / JS / TS │
       │  - Accessibility Tree Parsing │ │  - SSE Transport        │ │  - Process Jails    │
       │  - Bézier Mouse Humanizer     │ │  - Tool Registry        │ │  - Tool Synthesizer │
       └───────────────────────────────┘ └─────────────────────────┘ └─────────────────────┘
```

### Language & Framework Selection

To build a single cross-platform codebase across Windows, macOS, and Linux that supports transparent floating overlays, global system-wide hotkeys, and intense background workloads (headless browser automation and user browser, dynamic code execution, local audio capture(it use the parakeet v3 tts)), the optimal architecture is a **hybrid runtime: Tauri v2 (Rust) + TypeScript/Node.js Agent Daemon**.

| **Layer** | **Recommended Technology** | **Why Selected** |
| --- | --- | --- |
| **App Shell & Native OS Hooks** | **Tauri v2 (Rust)** | Memory footprint is negligible (~30–40 MB vs. Electron’s ~300 MB). Supports multi-window natively (essential for keeping a transparent, borderless floating voice HUD persistent over other apps), system tray, global OS shortcut listeners, and secure hardware access. |
| **Desktop UI Layer** | **TypeScript + React (Tailwind CSS)** | Renders both the full dashboard and the floating voice HUD. High responsiveness, scannable state displays, and broad ecosystem compatibility. |
| **Agent Core & Orchestration** | **TypeScript (Node.js or Bun Daemon)** | The official MCP SDKs, browser automation tooling (Playwright CDP), and multi-channel messaging libraries (grammY, Discord.js, Baileys) are natively designed in TypeScript. Communicates with Tauri via high-speed internal IPC/WebSocket. |
| **Sandbox Execution Runner** | **Isolated Subprocess Jails (Python 3.11+ / Node.js)** | Runs generated Python/TS scripts with OS-level boundary enforcement (cgroups on Linux, Job Objects on Windows, `sandbox-exec` on macOS). |

### Fractal Multi-Agent Subsystem (Recursive Architecture)

The system treats every agent as an **Actor**. Every sub-agent is not a degraded helper; it is an identical instance of the root agent class, equipped with its own context window, tool registry, memory store, and the capability to spawn further sub-agents.

```
                  ┌──────────────────────┐
                  │      Root Agent      │
                  │  (Budget: 100k tokens│
                  │   Depth: 0)          │
                  └──────────┬───────────┘
                             │ Spawns
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│     Sub-Agent A      │          │     Sub-Agent B      │
│ (e.g., Code Gen)     │          │ (e.g., Research)     │
│ Depth: 1             │          │ Depth: 1             │
└──────────┬───────────┘          └──────────┬───────────┘
           │ Spawns                          │ Spawns
           ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│   Sub-Sub-Agent A1   │          │   Sub-Sub-Agent B1   │
│ (e.g., AST Tester)   │          │ (e.g., DOM Scraper)  │
│ Depth: 2             │          │ Depth: 2             │
└──────────────────────┘          └──────────────────────┘
```

- **Context Isolation:** Sub-agents do not inherit the parent's full prompt history (which prevents context bloat). They receive only a clean operational objective, relevant environmental variables, and specific injected memory snapshots.

### Browser control Engine

Vision models (VLM screenshots) are slow, resource-heavy, and expensive for continuous site browsing. The browser automation engine uses a **Dual-Mode Pipeline**: headless semantic accessibility parsing as primary, with vision fallback only when semantic parsing fails.

user can see everything when this agent doing thinks and also user can see the mouse of the agent and in the bottom of the mouse user can the name of the agent who controling this .this can control the user browser and also the agent own browser.

```
                           Target Web Page
                                  │
                                  ├────────────────────────────────────────┐
                                  ▼                                        ▼
                     Accessibility Tree Extraction               CDP Raw DOM Tree
                     (Roles, Names, States, Bounds)              (Fallback Elements)
                                  │                                        │
                                  └───────────────────┬────────────────────┘
                                                      │
                                                      ▼
                                       Pruned Interactive Snapshot
                                   (Only interactive nodes: buttons,
                                    inputs, links with generated IDs)
                                                      │
                                                      ▼
                                           LLM Action Decision
                                     (e.g., click(id=14), type(id=2))
                                                      │
                                                      ▼
                                        Humanized Action Engine
                                      - Cubic Bézier Mouse Paths
                                      - Micro-Jitter & Overshoot
                                      - Humanized Keystroke Delays
                                                      │
                                                      ▼
                                            Physical Page Trigger
```

- **"Blind" Navigation via Accessibility Tree (AXTree):**
    - Extracts the Chrome DevTools Protocol (CDP) accessibility tree instead of raw HTML. This removes hundreds of lines of useless structural `<div>` elements and reduces the page into interactive nodes: buttons, links, inputs, combos, and text blocks.
    - Assigns a transient numeric selector to every actionable element (`[id=1]`, `[id=2]`). The agent issues instructions like `click(target_id=14)` without needing vision processing.
- **Humanized Interaction Pipeline:**
    - **Mouse Trajectories:** Utilizes cubic Bézier curves with randomized control points to simulate non-linear human movement. Incorporates micro-overshoots (moving slightly past the target, then correcting) and acceleration/deceleration curves.
    - **Input Timing:** Types with Gaussian-distributed keypress intervals (60–140ms per stroke) with occasional simulated pauses or backspace corrections on long form fields.
    - **Anti-Bot Stealth:** Injects standard evasions via CDP (overriding `navigator.webdriver`, spoofing WebGL vendor strings, matching real screen resolutions, handling randomized viewport sizes).

### Dynamic Tool Synthesis & Sandbox Architecture

When an agent encounters a problem that existing tools or MCP servers cannot solve, it triggers the **Runtime Code-as-Action** loop: writing, validating, and running ad-hoc Python or TypeScript code.

```
[Agent Task] ──► [Tool Registry Check]
                        │
                        ├─► Found ────────► [Execute Tool Directly]
                        │
                        └─► Not Found ────► [Code-as-Action Synthesizer]
                                                   │
                                                   ▼
                                        [1. Generate Code (Py/TS)]
                                                   │
                                                   ▼
                                        [2. Static AST & Safety Lint]
                                            (Block: shell escapes,
                                             raw disk wipes, system files)
                                                   │
                                                   ▼
                                        [3. Execute in Sandbox Jail]
                                            (Ephemeral environment,
                                             timeout caps, strict stdout/stderr)
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                                [Success]                      [Error]
                                    │                             │
                     [Register to Transient Cache]    [Feedback to Agent Loop
                     (Available for current run)       for Self-Correction]
```

- **Safety Boundaries & Sandboxing:**
    - *Windows:* Process execution constrained inside a restricted Windows Job Object (limits CPU percentage, memory cap, and limits child process creation).
    - *Linux/macOS:* Runs inside a low-privilege isolated subprocess utilizing sandboxing profiles (restricting access to root directories, user credentials, and network sockets unless explicitly flagged by the user).
- **Tool Promotion System:** Synthesized tools that run successfully and provide value can be tagged as "Reusable." The user can approve elevating a script into a permanent skill stored in the agent's MCP or custom skill registry.

### Extensible MCP Integration

The architecture incorporates the **Model Context Protocol (MCP)** specification:

- **MCP Host Implementation:** The central daemon acts as an MCP Host. It manages the lifecycle of multiple **MCP Clients**, connecting to local tools via `stdio` (e.g., SQLite explorers, local file indexers) and remote services via `Server-Sent Events (SSE)` / HTTP.
- **Dynamic Discovery:** On launch, the MCP Host queries all connected MCP servers (`tools/list`, `resources/list`). It compiles tools into standardized function-calling JSON schemas compatible with both OpenAI and Anthropic format engines.
- **Server Isolation:** MCP servers cannot inspect other servers or read global conversation history; they only receive parameter inputs for approved tool invocations.

### Floating Voice Micro-HUD (Global Hotkey Overlay)

To enable interaction without switching focus from active applications, the system maintains a decoupled secondary window.

```
                      Global Hotkey (e.g., Cmd/Ctrl + Shift + Space)
                                            │
                                            ▼
                       Tauri v2 Invisible/Visible Toggle
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │          Floating Voice Micro-HUD           │
                     │  - Frameless, translucent, always-on-top    │
                     │  - Floating waveform / recording indicator  │
                     │  - Active Target Agent Selector (Pill)      │
                     └──────────────────────┬──────────────────────┘
                                            │
                                            ▼
                              Streaming Audio Capture
                                            │
                     ┌──────────────────────┴─────────────────────────────┐
                     ▼                                                    ▼
       [Local Engine: Whisper.cpp or the parakeet v3]                   [Cloud Engine: Whisper API]
       - Zero-latency, fully private                                - Fallback if local GPU/CPU
       - Runs directly on host threads                             compute is resource-constrained
                     └──────────────────────┬─────────────────────────────┘
                                            │ Transcribed Prompt
                                            ▼
                            Agent Target Dispatcher
              (Directs command to selected Agent without
               opening main window; streams short answer back or executes)
```

- **Window Management:** Configured via Tauri with properties: `always_on_top: true`, `decorations: false`, `transparent: true`, and centered dynamically on the active monitor cursor.
- **Streaming STT Engine:** Local `whisper.cpp` linked via native C++ bindings for zero network dependency and instant push-to-talk transcription. Fallback toggle to OpenAI/Groq Whisper API for low-spec machines.it also Support parakeet v3.
- **Quick Routing:** Displays a minimalist agent switcher chip (e.g., `[General]`, `[Coder]`, `[Scraper]`). The user records their command, the transcribed text is routed to that agent's queue, and a notification banner or inline popover confirms execution.

### Omni-Channel Gateway

A background adapter bridges external messaging platforms into the local agent network.

```
 [Telegram]   [WhatsApp]   [Discord]   [Slack]   [Signal]
     │             │           │          │          │
     └─────────────┴───────────┼──────────┴──────────┘
                               ▼
                   Unified Message Ingestion
                               │
            ┌──────────────────▼──────────────────┐
            │       Message Normalization         │
            │  Extracts: sender, text, media,     │
            │  channel_id, platform_type          │
            └──────────────────┬──────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │        Session Router Table         │
            │  Maps channel/user to target Agent  │
            │  (e.g., Telegram User X ──► DevBot) │
            └──────────────────┬──────────────────┘
                               │
            ┌──────────────────▼──────────────────┐
            │     Agent Execution Pipeline        │
            └──────────────────┬──────────────────┘
                               │
                               ▼
                  Platform Response Adapters
                 (Chunking, Markdown formats)
```

- **Stateful Channel Mapping:** A persistent routing table maps incoming threads to specific agents:
    - *Telegram (grammY)* $\rightarrow$ Direct chats can be locked to specific Sub-Agents.
    - *WhatsApp (Baileys / Web Socket)* $\rightarrow$ Background persistent session.
    - *Discord (Discord.js)* $\rightarrow$ Channel-specific bot mappings.
    - *Slack (`@slack/bolt`)* $\rightarrow$ Workspace integration.
    - *Signal (`signal-cli` wrapper)* $\rightarrow$ Secure, end-to-end encrypted message interface.
- **Format Adaptation:** Standardizes markdown across platforms (e.g., converting standard markdown bold `*text**` to Telegram HTML `<b>` or WhatsApp `text*`).

### Model Provider Agnosticism & Secret Vault

The model layer must handle varied API structures cleanly without locking the user into a specific vendor.

```
                     Unified LLM Request Interface
            (Model, Temperature, Messages[], Tools[], Stream)
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [OpenAI-Format Engine]              [Anthropic-Format Engine]
        - OpenAI                            - Anthropic Native API
        - DeepSeek / Groq / vLLM            - Custom Headers
        - Local Ollama / llama-server       - System Prompt Isolation
        - Custom Base URL + Auth            - Tool Choice Format
                  └─────────────────┬─────────────────┘
                                    │
                                    ▼
                         OS Native Secret Vault
                       (Keytar / OS Keyring API)
                 - Encrypted disk storage
                 - Zero plaintext config files
```

- **Adapter Pattern:**
    - *OpenAI Engine:* Routes standard `/v1/chat/completions` with support for custom base URLs, Bearer tokens, and function schema definitions.
    - *Anthropic Engine:* Translates universal agent messages into Anthropic’s native `/v1/messages` format, handling top-level system prompts, `input_schema` tool definitions, and content-block streaming.
- **Security Architecture:** API keys and webhooks are never stored in plain `.json` or `.env` files. They are piped to the operating system's native secret manager: **Windows Credential Manager**, **macOS Keychain**, or **Linux Secret Service (Freedesktop)**.

### Architectural Failure Modes & Defenses

- **Recursive Sub-Agent Death Spirals:**
    - *Risk:* Agent A spawns Sub-Agent B, which encounters an error and spawns Sub-Agent C, consuming infinite tokens and system memory.
    - *Defense:* Hard recursion limit (`depth <= 3`), global concurrent sub-agent cap (max 5 active simultaneously), and strict parent-level timeout abort controllers (default 60s per child).and also user can create also so many agents .
- **Malicious or Destructive Code Generation:**
    - *Risk:* The agent writes a script with `rm -rf /`, `del /s /q C:`, or opens backdoors.
    - *Defense:* Static AST inspection blocks hazardous OS module calls (`os.system`, `subprocess.Popen`, `child_process.exec`) unless explicitly unlocked by the user via an in-app permission dialog.
- **Memory Leaks from Browser Automation:**
    - *Risk:* Headless Chromium instances pile up during iterative scraping, exhausting host RAM.
    - *Defense:* A centralized **Browser Pool Manager** that enforces a maximum of 2 active browser contexts, recycling pages after 15 minutes of idle time.

### Production Monorepo Project Structure

To package Tauri v2, the React UI, the background TypeScript daemon, browser automation, and sandboxing into a single distributable binary without restructuring later, organize the repository as a **pnpm workspace monorepo**.

```
krypton/
├── .github/
│   └── workflows/
│       └── release.yml                # Cross-compilation CI (Windows, macOS, Linux)
├── apps/
│   └── desktop/                       # Tauri v2 Desktop Application Shell
│       ├── src-tauri/                 # Rust Native Backend
│       │   ├── src/
│       │   │   ├── main.rs            # App entrypoint & Tauri setup
│       │   │   ├── commands/          # Rust IPC commands invoked from UI
│       │   │   │   ├── audio.rs       # Microphone capture & Parakeet v3/Whisper bindings
│       │   │   │   ├── hotkey.rs      # Global OS shortcut manager
│       │   │   │   ├── installer.rs   # Auto-registers CLI binary to system PATH
│       │   │   │   └── sidecar.rs     # Daemon process lifecycle & health checks
│       │   │   ├── overlay.rs         # Transparent, borderless voice HUD controller
│       │   │   └── paths.rs           # ~/.krypton directory resolver & permission checks
│       │   ├── binaries/              # Target-specific sidecar binaries (Node/Bun daemons)
│       │   │   ├── krypton-daemon-x86_64-pc-windows-msvc.exe
│       │   │   ├── krypton-daemon-x86_64-apple-darwin
│       │   │   ├── krypton-daemon-aarch64-apple-darwin
│       │   │   └── krypton-daemon-x86_64-unknown-linux-gnu
│       │   ├── icons/                 # Platform application icons (.ico, .icns, .png)
│       │   ├── Cargo.toml             # Rust dependencies
│       │   └── tauri.conf.json        # Tauri v2 bundle, window, and permission configs
│       ├── src/                       # Frontend UI (React + Tailwind CSS)
│       │   ├── app/
│       │   │   ├── dashboard/         # Main workspace window
│       │   │   │   ├── page.tsx
│       │   │   │   └── components/    # Agent canvas, tool viewer, settings, preview tab
│       │   │   └── overlay/           # Minimal floating voice HUD window
│       │   │       ├── page.tsx
│       │   │       └── components/    # Audio wave, quick agent selector
│       │   ├── components/
│       │   │   ├── TodoTree.tsx       # Real-time task progress tracker
│       │   │   ├── QuestionModal.tsx  # Clarification prompt modal (HITL)
│       │   │   └── VcsDiffViewer.tsx  # Visual Git diff & branch merge UI
│       │   ├── hooks/                 # Tauri IPC and WebSocket hooks
│       │   ├── styles/
│       │   └── index.html
│       ├── package.json
│       ├── tailwind.config.ts
│       └── tsconfig.json
├── packages/
│   ├── agent-runtime/                 # Core Daemon Engine compiled into Tauri Sidecar
│   │   ├── src/
│   │   │   ├── index.ts               # Daemon entrypoint (starts local IPC/WebSocket server)
│   │   │   ├── actor/                 # Recursive Actor-Model sub-agent system
│   │   │   │   ├── agent.ts           # Universal agent instance class
│   │   │   │   ├── scheduler.ts       # Task queue, token budget, depth limiter
│   │   │   │   └── state.ts           # Agent execution frames & memory sync
│   │   │   ├── planner/               # Dynamic Todo DAG & task coordinator
│   │   │   │   ├── task-tree.ts       # Hierarchical task tree engine
│   │   │   │   └── replanner.ts       # Dynamic error recovery & plan restructuring
│   │   │   ├── interaction/           # Human-in-the-loop clarification bus
│   │   │   │   ├── prompt-bus.ts      # Multi-channel question dispatcher
│   │   │   │   └── resolver.ts        # Input listener & promise unblocker
│   │   │   ├── vcs/                   # Git automation engine
│   │   │   │   ├── worktree.ts        # Isolated branch workspaces
│   │   │   │   ├── commit.ts          # Semantic auto-commit generator
│   │   │   │   └── diff.ts            # Patch, rollback, & merge handling
│   │   │   ├── trajectory/            # Verifiable execution traces (Prime-Agent pattern)
│   │   │   │   ├── recorder.ts        # Action-observation trajectory recorder
│   │   │   │   └── verifier.ts        # Pre-completion validation harness
│   │   │   ├── context/               # Context window optimization
│   │   │   │   ├── condenser.ts       # Compresses context window at 90% utilization
│   │   │   │   └── offloader.ts       # Masks massive tool outputs & saves to disk
│   │   │   ├── steering/              # Mid-flight execution control
│   │   │   │   └── dual-buffer-queue.ts # Intercepts user steering during active execution
│   │   │   ├── terminal/              # Persistent interactive terminals
│   │   │   │   ├── pty-pool.ts        # Long-running interactive PTY sessions
│   │   │   │   └── ansi-cleaner.ts    # Cleans terminal escape codes
│   │   │   ├── intelligence/          # Codebase AST & Language Server bridge
│   │   │   │   ├── tree-sitter.ts     # Fast AST symbol and function indexing
│   │   │   │   └── lsp-client.ts      # Headless Language Server Protocol bridge
│   │   │   ├── desktop-os/            # Native OS-level automation
│   │   │   │   ├── native-tree.ts     # Windows UIA / macOS AXUIElement OS-wide automation
│   │   │   │   └── window-manager.ts  # Focuses, minimizes, and controls native OS apps
│   │   │   ├── event-sourcing/        # Crash resilience & task recovery
│   │   │   │   ├── event-store.ts     # Append-only events.jsonl writer
│   │   │   │   └── recovery.ts        # Rehydrates state and resumes broken tasks
│   │   │   ├── providers/             # LLM API Gateways
│   │   │   │   ├── anthropic.ts       # Anthropic format adapter
│   │   │   │   ├── openai.ts          # OpenAI standard adapter (Ollama/Groq/DeepSeek)
│   │   │   │   └── vault.ts           # OS keyring bridge (Keytar / system secret store)
│   │   │   ├── filesystem/            # ~/.krypton state management
│   │   │   │   ├── bootstrap.ts       # Initializes ~/.krypton on first run
│   │   │   │   ├── parser.ts          # Reads/writes markdown configurations
│   │   │   │   └── watcher.ts         # Hot-reloads memory when files change on disk
│   │   │   ├── mcp/                   # Model Context Protocol Host
│   │   │   │   ├── client.ts          # Stdio and SSE transport handlers
│   │   │   │   └── registry.ts        # Aggregates tools into LLM schemas
│   │   │   ├── sandbox/               # Dynamic Code-as-Action Runner
│   │   │   │   ├── runner.ts          # Process jail execution manager
│   │   │   │   ├── linter.ts          # AST validator blocking dangerous calls
│   │   │   │   └── templates/         # Python/TS execution starter scripts
│   │   │   ├── browser/               # Stealth Playwright / CDP Engine
│   │   │   │   ├── browser.ts         # Headless browser instance pooling
│   │   │   │   ├── axtree.ts          # Accessibility tree extraction & node labeling
│   │   │   │   ├── humanizer.ts       # Cubic Bézier mouse paths & typing jitters
│   │   │   │   └── actions.ts         # Blind navigation primitives (click, scroll, type)
│   │   │   └── channels/              # Multi-Platform Gateway
│   │   │       ├── router.ts          # Maps incoming messages to agent sessions
│   │   │       ├── telegram.ts        # grammY bridge
│   │   │       ├── discord.ts         # Discord.js bridge
│   │   │       ├── whatsapp.ts        # Baileys bridge
│   │   │       ├── slack.ts           # Slack Bolt bridge
│   │   │       └── signal.ts          # Signal-cli IPC bridge
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── cli/                           # Standalone TypeScript CLI Engine
│   │   ├── src/
│   │   │   ├── index.ts               # CLI router (krypton <cmd>)
│   │   │   ├── ui/                    # Ink/React TUI components
│   │   │   │   ├── TaskListView.tsx   # Terminal Todo progress bars
│   │   │   │   └── QuestionPrompt.tsx # Terminal interactive selector
│   │   │   ├── ipc-client.ts          # Communicates with krypton-daemon
│   │   │   └── commands/              # run, vcs, agents, tools
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared-types/                  # Shared TypeScript interfaces
│   │   ├── src/
│   │   │   ├── agent.ts               # Message, Context, and State types
│   │   │   ├── mcp.ts                 # Tool definitions and JSON schemas
│   │   │   ├── tasks.ts               # Todo DAG and status types
│   │   │   ├── interaction.ts         # ClarificationRequest schemas
│   │   │   ├── vcs.ts                 # Commit, branch, and diff types
│   │   │   └── ipc.ts                 # Tauri-to-Daemon event signatures
│   │   ├── package.json
│   │   └── tsconfig.json
├── scripts/
│   ├── build-sidecar.mjs              # Compiles packages/agent-runtime into 1 binary
│   ├── build-cli.mjs                  # Compiles packages/cli into 1 native executable
│   └── setup-env.mjs                  # Verifies Playwright and local runtime prerequisites
├── package.json                       # Monorepo root package.json
├── pnpm-workspace.yaml                # Workspace package manifest
└── tsconfig.base.json
```

### Runtime Structure: The `~/.krypton` System Folder

When the user launches the app on any operating system, the application checks for the existence of `.krypton` in the user's home directory (`%USERPROFILE%\.krypton` on Windows, `$HOME/.krypton` on macOS and Linux). If absent, it bootstraps this directory with default configuration templates:

```markdown
~/.krypton/
├── config.json                        # Global app config & CLI preferences
├── credentials.enc                    # AES-256 encrypted provider keys
├── cache/                             # Transient runtime caches
│   └── outputs/                       # Truncated tool outputs offloaded from context window
│       └── run_step_102.log
├── pty_sessions/                      # Persistent terminal socket logs and state
├── telemetry/                         # OpenTelemetry traces, token costs, and latency metrics
├── agents/                            # Dedicated workspace per agent [Folder Name = Agent Name]
│   ├── orchestrator/                  # Established Agent (Bootstrap completed)
│   │   ├── AGENTS.md                  # Sub-agent permissions & recursion caps
│   │   ├── SOUL.md                    # Immutable behavioral guidelines
│   │   ├── IDENTITY.md                # System prompt & assigned tool manifest
│   │   ├── USER.md                    # Agent-specific user preferences
│   │   ├── MEMORY.md                  # Long-term distilled memory
│   │   ├── TODO.md                    # Live state of active task tree (human-readable)
│   │   └── short_term/                # Raw conversation, event store & trajectory records
│   │       ├── session_2026-09-15.json
│   │       ├── events.jsonl           # Append-only event store for crash recovery
│   │       └── trajectories/          # Step-by-step verified action traces
│   └── web_scraper/                   # Newly Created Agent (Uninitialized)
│       ├── BOOTSTRAP.md               # First-run onboarding file (auto-cleared after setup)
│       ├── AGENTS.md                  # Permissions to spawn parser/scraper sub-agents
│       ├── SOUL.md                    # Stealth and rate-limit guardrails
│       ├── IDENTITY.md                # Scraper system prompt and tool mappings
│       ├── USER.md                    # Domain targets and scraping rules
│       └── short_term/                # Session logs directory
├── worktrees/                         # Isolated Git working trees for coding tasks
│   └── task-refactor-auth-89a1/       # Agent scratchpad isolated from main workspace
├── tools/                             # Global reusable runtime tools (shared across all agents)
│   ├── python/                        # Auto-synthesized Python scripts
│   │   └── data_extractor.py
│   └── typescript/                    # Auto-synthesized TypeScript utilities
│       └── json_formatter.ts
├── browser_profiles/                  # Shared persistent browser sessions, cookies, and storage
│   └── default/
│       ├── Cookies
│       └── Local Storage
└── logs/                              # Audit trails for sandboxes, VCS, and executions
    ├── vcs_audit.log                  # Record of all git branches, commits, and rollbacks
    ├── agent_execution.log            # Daemon orchestration log
    └── sandbox_errors.log             # Sandboxed script failures
```

### Per-Agent File Roles

- **`AGENTS.md`**: Defines recursion boundaries for this agent. Lists which sub-agents it can spawn, the maximum allowed depth (`max_depth`), tool access rules, and budget delegation caps.
- **`SOUL.md`**: Immutable character and reasoning directives. Sets how the agent thinks, its tone, handling of failures, safety boundaries, and whether it prioritizes speed, precision, or strict verification.
- **`IDENTITY.md`**: Operational configuration. Contains the active model provider, specific model name (e.g., Claude, DeepSeek, local GGUF), system prompt prefix, and designated MCP/local tool list.
- **`USER.md`**: The agent’s local view of the user. Captures preferences, recurring commands, domain requirements, and specific instructions relevant only to this agent's task scope.
- **`BOOTSTRAP.md`**: Present **only** on newly created agents. Contains initial setup questions or priming tasks (e.g., "Analyze the user's codebase", "Authenticate headless browser"). The runtime executes this file on the first run and deletes or archives it once initialization finishes.
- **`MEMORY.md`**: Distilled long-term context. The agent updates this file autonomously with extracted user facts, recurring patterns, and successful strategies. Only loaded when present; uninitialized agents skip this file.
- **`short_term/`**: Append-only storage for session transcripts. Each chat or external channel trigger (Telegram, Discord, Voice HUD) outputs a timestamped JSON or Markdown file to maintain context across restarts without bloating the main model context window.

### Global Infrastructure Layer

- **`tools/` (Global)**: Keeps synthesized scripts accessible to all agents so an agent doesn't regenerate a tool that another agent already verified and saved.
- **`browser_profiles/` (Shared)**: Retains authenticated browser state (cookies, local storage) across agents, preventing repeated CAPTCHA and login checks.
- **`sandbox_workspace/`**: Prevents file collisions by providing a sandbox disk space for ad-hoc Python/Node scripts to run without reading or modifying personal user directories directly.

### Packaging Strategy: Bundling Everything into One Distribution

To deliver a single executable installer without forcing end-users to install Node.js, Bun, or complex toolchains:

```
[packages/agent-runtime]
          │
          ▼
   (bun build --compile / pkg)
          │
          ▼
Single Native Binary (crypton-daemon)
          │
          ▼
 Placed into: apps/desktop/src-tauri/binaries/
          │
          ▼
   (tauri build)
          │
          ├─────────────────────────────────────────┐
          │ Bundles:                                │
          │ - Tauri Rust App + Multi-Window Shell   │
          │ - React Dashboard + Voice HUD (Assets)  │
          │ - krypton-daemon (As an OS Sidecar)     │
          │ - Minimal Playwright Driver Bundles     │
          └─────────────────────────────────────────┘
          │
          ▼
 Single Distributable Installer (.msi/.exe, .dmg, .deb/.AppImage)
```

1. **Compiling the Node/Bun Daemon into a Standalone Binary:**
    - Run `bun build --compile --minify --target=bun-[platform] ./packages/agent-runtime/src/index.ts --outfile ./apps/desktop/src-tauri/binaries/krypton-daemon-[triple]`
    - This packs the TypeScript code, the MCP runtime, and the channel dependencies into an isolated binary.
2. **Configuring the Tauri v2 Sidecar (`tauri.conf.json`):**JSON
    
    ```
    {
      "bundle": {
        "active": true,
        "targets": "all",
        "externalBin": [
          "binaries/krypton-daemon"
        ]
      }
    }
    ```
    
    Tauri handles starting, monitoring, and killing this background daemon when the desktop window opens and closes.
    
3. **Handling the Headless Browser Dependency:**
    - Ship the Playwright driver scripts inside the sidecar binary.
    - On first boot, the bootstrap module checks if the local headless Chromium browser exists in `~/.krypton/browser_binaries`. If missing, the app triggers a background download progress bar in the desktop UI to pull the lightweight build, preventing the initial installer size from swelling past 100 MB.
4. **Installer Output Artifacts:**
    - **Windows:** `.msi` or NSIS `.exe` installer (installs app, registers system tray, provisions `%USERPROFILE%\.krypton`).
    - **macOS:** `.dmg` / `.app` (notarized, sets accessibility permissions for global hotkeys).
    - **Linux:** `.AppImage` or `.deb` (sets up desktop entry and `~/.krypton`).

## Subsystem: Git Version Control Engine (Krypton-VCS)

The system integrates an automated version control engine allowing agents to work inside Git repositories without risking user data loss:

- **Branch & Worktree Isolation**: Coding tasks automatically spin up an isolated Git worktree under `~/.krypton/worktrees/<task-id>`. Agents never modify the active branch directly.
- **Autonomous Checkpoint Commits**: Each completed task step generates an atomic, semantic commit.
- **Deterministic Rollback**: If a tool invocation breaks tests or fails AST linting, the engine executes a hard rollback to the last verified commit hash.
- **Merge Gateways**: Merging an agent's worktree back into the working branch requires user approval via Desktop UI diff inspector or `krypton vcs merge` in the CLI.

## Subsystem: Cross-Platform TypeScript CLI (`krypton-cli`)

A native CLI companion is bundled directly inside the desktop installer and placed in the OS system PATH:

- **Unified Daemon IPC**: Connects to the running `krypton-daemon` via platform-native pipes (Named Pipes on Windows, Domain Sockets on POSIX).
- **Interactive TUI**: Built with TypeScript + Ink to render live task checklists, progress spinners, interactive diff views, and clarification selectors in the terminal.
- **Headless Execution**: If the desktop UI is closed, running any CLI command initializes the runtime daemon in headless mode.

## Subsystem: Dynamic Task Planner & Todo Engine

Implements dynamic task orchestration and tracking:

- **Hierarchical Task DAG**: Complex instructions decompose into an ordered Directed Acyclic Graph of sub-tasks stored in memory and reflected in `TODO.md`.
- **Dynamic Plan Repair**: If a task fails, the agent pauses execution, analyzes the error, and restructures subsequent tasks dynamically.
- **Multi-Client State Sync**: Task updates stream live to the Desktop dashboard, the CLI progress UI, and external channels via edited chat bubbles.

```markdown
[User Objective] ──► [Task Planner: Generates Task DAG]
                             │
                             ▼
                    ┌──────────────────┐
                    │ Task 1: Scan repo│ [Completed]
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Task 2: Refactor │ [In Progress]
                    └────────┬─────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Error Encountered]              [Step Successful]
            │                                 │
            ▼                                 ▼
 [Dynamic Plan Revision]            [Advance to Task 3]
 (Inserts: Task 2b - Fix Bug)
```

## Subsystem: Cross-Channel Human-in-the-Loop (HITL) Engine

When an agent encounters ambiguous instructions or requires confirmation:

- **Clarification Bus**: The agent dispatches a structured `ClarificationRequest` containing the question, predefined selection options, and an optional freeform text field.
- **Universal Input Resolution**:
    - **Desktop UI**: Pop-up modal with keyboard navigation and choice pills.
    - **Terminal CLI**: Interactive arrow-key menu with custom answer entry.
    - **Messaging Channels**: Inline interactive buttons for Telegram, Discord, and Slack; indexed numeric choices for WhatsApp and Signal.
    - **Voice HUD**: Transcribes spoken user replies via Parakeet v3 to resolve questions hands-free.

## Subsystem: Trajectory Logging & Verification (Prime-Agent Pattern)

Borrowed from the PrimeIntellect `prime-agent` architecture to enforce reliability:

- **Step Trajectory Records**: Agents record step-by-step `(action, observation, tool_call, delta)` frames stored under `short_term/trajectories/`.
- **Pre-Completion Harness**: Before marking a task "Complete," the agent executes automated validation suites (linters, type-checkers, unit tests, or headless accessibility checks). If verification fails, the task state switches to `failed` and triggers the replanner.

## People can set up this software by the software application GUI and the terminal.

## Subsystem: Context Condenser & Output Masking

- **Observation Masking**: Tool responses exceeding 1,500 tokens are written to `~/.krypton/cache/outputs/` and substituted in prompt context with a head/tail summary and line counts.
- **Context Compaction**: At 90% context consumption, the conversation history is summarized into an updated state checkpoint, preserving the active objective, task tree, and key file diffs while clearing past intermediate turns.

## Subsystem: Mid-Flight Asynchronous Steering

- **Dual-Buffer Event Queue**: The execution loop polls for user input between every tool call.
- **Dynamic Course Correction**: Spoken (HUD) or typed (CLI/UI) user instructions inject directly into the running context, triggering the dynamic replanner without terminating active agent sub-trees.

## Subsystem: Persistent PTY Engine

- **Long-Running Process Jails**: Dev servers (`npm run dev`, Docker instances) run inside isolated pseudo-terminals (`node-pty`), allowing background monitoring without freezing the primary agent loop.
- **Interactive Stdin**: Agents can pass interactive inputs (e.g., confirmations, auth credentials) directly to persistent terminal sessions.

## Subsystem: Codebase Intelligence (LSP & Tree-sitter)

- **Semantic Code Graph**: Integrates Tree-sitter for zero-cost AST symbol mapping and headless LSPs for compiler diagnostics, reference checking, and type-definition lookups.

## Subsystem: Native Desktop Automation

- **System Accessibility Trees**: Extends beyond browser automation by tapping native OS accessibility APIs (Windows UIA, macOS AXUIElement) to read controls, click buttons, and inspect desktop-native windows.

## Subsystem: Event-Sourced Crash Resumption

- **Append-Only Event Store**: All state mutations are logged to `events.jsonl`. Sudden process terminations allow resumption from the exact failed step using the cached Git worktree state.