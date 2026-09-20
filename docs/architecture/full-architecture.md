# Krypton — Comprehensive System Architecture Specification

This document provides the definitive, comprehensive architectural specification for the **Krypton** Autonomous Agent Operating System. It covers all monorepo packages, process lifecycles, IPC protocols, the autonomous Actor execution engine, sandboxing, isolated Git worktrees, persistent memory, and cryptographic credential management.

> 🗺️ **Interactive Architectural Visualization**:
> An interactive SVG diagram built with the [`diagram-design`](../../.agents/skills/diagram-design/SKILL.md) design system is available at [`system-architecture-diagram.html`](./system-architecture-diagram.html). Open it in any modern browser to inspect subsystems, interactive nodes, and switch between Light and Dark editorial palettes.

---

## 1. High-Level Architectural Topology

Krypton operates as a decentralized, local-first operating system designed to execute complex, multi-step autonomous coding and computer use workflows with zero required cloud daemon infrastructure.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    TIER 1: PRESENTATION & CLIENT SHELLS                      │
│                                                                              │
│  ┌───────────────────────────────┐     ┌──────────────────────────────────┐  │
│  │ Primary Desktop Workstation   │     │ Floating Voice Micro-HUD         │  │
│  │ (Next.js 16 / React 19)       │     │ (Translucent / Ctrl+Shift+Space) │  │
│  └──────────────┬────────────────┘     └─────────────────┬────────────────┘  │
│                 │                                        │                   │
│                 └───────────────────┬────────────────────┘                   │
│                                     │ Tauri Native IPC                       │
│                                     ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    Tauri v2 Native Rust Core Shell                     │  │
│  │                    (Sidecar Supervisor & Window Manager)               │  │
│  └──────────────────────────────────┬─────────────────────────────────────┘  │
│                                     │                                        │
│  ┌───────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Terminal CLI Companion        │  │  │ Omni-Channel Gateway             │  │
│  │ (krypton-cli / React 18+Ink)  │  │  │ (Telegram, Discord, Slack...)    │  │
│  └──────────────┬────────────────┘  │  └─────────────────┬────────────────┘  │
└─────────────────┼───────────────────┼────────────────────┼───────────────────┘
                  │                   │ Spawns & Supervises│
                  │                   ▼ (SIGTERM / Kill)   │
┌─────────────────┼────────────────────────────────────────┼───────────────────┐
│                 │  TIER 2: MULTI-TRANSPORT IPC WIRE      │                   │
│                 ▼                                        ▼                   │
│  ┌──────────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Platform Local IPC Pipe / Socket     │  │ RFC 6455 WebSocket Server    │  │
│  │ Win: \\.\pipe\krypton-ipc            │  │ ws://127.0.0.1:18789         │  │
│  │ Unix: /tmp/krypton.sock              │  │ Real-time token streaming    │  │
│  │ JSON-RPC 2.0 Request/Response        │  │ task_tree_updated & logs     │  │
│  └──────────────────┬───────────────────┘  └──────────────┬───────────────┘  │
└─────────────────────┼─────────────────────────────────────┼──────────────────┘
                      │                                     │
                      ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            TIER 3: BACKGROUND AUTONOMOUS DAEMON CORE (krypton-daemon)        │
│                                                                              │
│  ┌─────────────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ Hierarchical Actor Engine           │ │ Dynamic Task Planner DAG       │  │
│  │ Universal Agent Loop                │ │ TaskTree Dependency Graph      │  │
│  │ max_depth <= 3 & concurrency <= 5   │ │ Error Replanner & PlanPatch    │  │
│  └──────────────────┬──────────────────┘ └────────────────┬───────────────┘  │
│                     │                                     │                  │
│                     ▼                                     ▼                  │
│  ┌─────────────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ AST Safety Linter & Sandbox Jail    │ │ Krypton-VCS Worktrees          │  │
│  │ Static Babel/Python AST analysis    │ │ Isolated ~/.krypton/worktrees/ │  │
│  │ Windows Job Object / POSIX rlimit   │ │ Atomic commits & hard rollback │  │
│  └──────────────────┬──────────────────┘ └────────────────┬───────────────┘  │
│                     │                                     │                  │
│  ┌──────────────────┴──────────────────┐ ┌────────────────┴───────────────┐  │
│  │ Stealth AXTree Browser Pool         │ │ Context Optimizer & HITL Bus   │  │
│  │ CDP Accessibility blind navigation  │ │ Output offloading (>1.5k toks) │  │
│  │ Numeric IDs [id=1] & Bézier curve   │ │ Compaction (>90%) & approvals  │  │
│  └─────────────────────────────────────┘ └────────────────────────────────┘  │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            TIER 4: LOCAL STORAGE, VAULT & STATE PERSISTENCE (~/.krypton)     │
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌───────────┐  │
│  │ Secret Vault     │ │ Agent Workspaces │ │ Event Sourcing │ │ Sandboxes │  │
│  │ OS Keyring +     │ │ config.json vs   │ │ events.jsonl & │ │ Ephemeral │  │
│  │ AES-256-GCM      │ │ pure *.md files  │ │ trajectories/  │ │ worktrees │  │
│  └──────────────────┘ └──────────────────┘ └────────────────┘ └───────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Package Topology & Technology Stack

Krypton is architected as a high-performance **pnpm** monorepo with strict package boundaries:

```
krypton/
├── apps/
│   └── desktop/                  # Tauri v2 native desktop application & React 19 frontend
│       ├── src/                  # Next.js 16 App Router UI (/dashboard, /overlay, /setup)
│       └── src-tauri/            # Rust native backend (Windowing, Tray, Sidecar supervisor)
├── packages/
│   ├── shared-types/             # Single source of truth: TypeScript types, Zod schemas, IPC
│   ├── agent-runtime/            # Headless autonomous agent core & daemon server
│   └── cli/                      # Standalone terminal companion (React 18 + Ink TUI)
├── docs/                         # Modular documentation suite & interactive SVG diagrams
├── scripts/                      # Binary packaging and platform compilation scripts
└── AGENTS.md                     # Monorepo governance & autonomous agent operating rules
```

### Monorepo Packages Summary

| Package / Directory | Name | Role | Technology Stack |
| :--- | :--- | :--- | :--- |
| `packages/shared-types` | `@krypton/shared-types` | Unified contract library, Zod validation schemas, IPC interfaces | TypeScript, Zod |
| `packages/agent-runtime` | `@krypton/agent-runtime` | Autonomous actor scheduler, daemon server, MCP host, AST sandbox, VCS | TypeScript, Bun / Node.js |
| `packages/cli` | `@krypton/cli` | Terminal user interface companion with interactive task viewer | React 18, Ink, Commander |
| `apps/desktop` | `desktop` | Cross-platform frameless desktop workstation & floating voice HUD | Tauri v2, Rust, Next.js 16, Tailwind CSS |
| `scripts/` | — | Cross-platform single-artifact sidecar bundlers | Node.js, Bun |

---

## 3. Process Lifecycle & Supervisor Architecture

### A. Boot & Discovery Cascade
1. **Desktop Shell Launch (`krypton.exe` / `Krypton.app`)**:
   - Rust native core (`apps/desktop/src-tauri/src/lib.rs`) initializes logger plugins and verifies the `~/.krypton/` directory tree (`ensure_krypton_directories()`).
   - Native windows (`main` and `overlay`) are instantiated in frameless mode.
2. **First-Run Inspection**:
   - `check_setup_status` audits `~/.krypton/config.json`.
   - If uninitialized, the UI displays `FirstRunSetupWizard`.
   - If initialized, navigates directly to `/dashboard`.
3. **Daemon Supervision (`spawn_daemon`)**:
   - The Rust supervisor searches for the `krypton-daemon` binary across prioritized paths:
     1. `std::env::current_exe().parent()`
     2. `../Resources/binaries/` (macOS Bundle)
     3. `$APPDIR/usr/bin/` (Linux AppImage)
     4. `~/.krypton/bin/`
     5. Development fallback: Node.js invocation of `packages/agent-runtime/dist/daemon.js`.
   - Spawns child process and binds a process monitoring thread.
4. **Heartbeat & IPC Connection**:
   - Frontend connects to `ws://127.0.0.1:18789` via `useKryptonDaemon`.
   - Rust supervisor executes periodic IPC pings to ensure sub-process health.

### B. Clean Teardown Protocol
To prevent orphaned processes, leaking browser instances, or corrupted Git worktrees:
- On window close or tray `Quit`:
  1. Supervisor transmits `SIGTERM` to `krypton-daemon`.
  2. Daemon commits pending `events.jsonl` buffers, closes active Chromium contexts, and unlocks worktrees (up to 3,000ms grace window).
  3. If daemon fails to exit within 3,000ms, supervisor enforces a recursive process tree kill (`killProcessTree` / Windows Job Object termination).
  4. Platform sockets (`\\.\pipe\krypton-ipc` or `/tmp/krypton.sock`) are unlinked.

---

## 4. Multi-Transport Wire & IPC Layer

The daemon exposes two simultaneous communication endpoints:

### A. Low-Latency Platform Named Pipes / Domain Sockets
- **Windows**: `\\.\pipe\krypton-ipc`
- **macOS / Linux**: `/tmp/krypton.sock`
- **Wire Protocol**: JSON-RPC 2.0 request/response.
- **Primary Consumers**: `krypton-cli`, Rust native supervisor, local scripts.

### B. RFC 6455 WebSocket Server
- **Endpoint**: `ws://127.0.0.1:18789`
- **Role**: Real-time bidirectional event streaming to the desktop frontend.
- **Streamed Event Types**:
  - `token_stream`: LLM token delta chunks (`{ delta, index, isComplete, taskId, agentId }`).
  - `agent_log`: Structured logs (`{ level, message, context }`).
  - `task_tree_updated`: Real-time serialized DAG node state mutations.
  - `clarification_requested`: Dispatched when an agent requires user disambiguation (HITL).
  - `tool_approval_requested`: High-priority event pausing runtime execution for sensitive actions.
  - `tool_execution`: Action execution results (`{ tool, stdout, status }`).

---

## 5. Background Autonomous Daemon Core (`packages/agent-runtime`)

### A. Universal Actor Execution Engine (`src/actor/`)
Every agent instance is modeled as an isolated Actor running an autonomous step loop:

```
[1. OBSERVE] ──► [2. REASON / PLAN] ──► [3. AST VALIDATE]
                                                │
[6. CHECKPOINT] ◄── [5. VERIFY] ◄── [4. EXECUTE SANDBOX]
```

- **Loop Steps**:
  1. **Observe**: Receives user prompt or observation from previous tool execution.
  2. **Reason**: Queries LLM provider, updates task DAG, and synthesizes tool calls.
  3. **AST Validate**: Pass synthesized code through static AST safety linter.
  4. **Execute**: Runs tools inside isolated Git worktree or constrained OS subprocess jail.
  5. **Verify**: Runs compilers, linters, and unit tests to validate output.
  6. **Checkpoint**: Commits verified progress and appends to `events.jsonl`.
- **Recursion & Concurrency Guardrails**:
  - `max_depth <= 3`: Agents at depth 3 cannot invoke `spawnChild()`.
  - Global Concurrency: Maximum 5 concurrent sub-agents; excess tasks queue.
  - Token Budgeting: Parent delegates up to 50% of remaining tokens to child.
  - Timeouts: 60s hard timeout per child task via `AbortController`.

### B. Dynamic Task Planner DAG (`src/planner/`)
- **TaskTree DAG**: Models complex objectives as an acyclic graph of `TaskNode` elements with explicit dependency arrays (`dependsOn`).
- **Dynamic Replanner**:
  - If a task fails (compilation error, broken test, linter failure), all downstream dependents are frozen (`blocked`).
  - Synthesizes a dynamic `PlanPatch` inserting remediation tasks.
  - Emits `task_tree_updated` event to animate graph changes in UI.
- **Ledger Synchronization**: Bidirectionally synchronizes graph state with `~/.krypton/agents/<name>/TODO.md`.

### C. Dynamic Code Sandboxing & AST Safety (`src/sandbox/`)
- **Static AST Linter (`linter.ts`)**:
  - Pre-execution parse with Babel (JS/TS) or Python AST.
  - Blocks dangerous calls: `child_process.exec`, `child_process.spawn`, `os.system`, `subprocess.Popen`, `eval()`, `new Function()`, `rm -rf /`, root disk writes.
- **OS Subprocess Jails (`runner.ts`)**:
  - **Windows**: Windows Job Objects enforce 512MB RAM ceiling, CPU priority throttling, and guaranteed child tree termination.
  - **macOS / Linux**: `posix_spawn` and `rlimit` (`RLIMIT_AS`, `RLIMIT_CPU`, `RLIMIT_NPROC`).
- **Ephemeral Workspaces**: All temporary execution occurs in `~/.krypton/sandbox_workspace/<exec-id>/` and is purged on completion.

### D. Krypton-VCS: Git Worktree Isolation (`src/vcs/`)
- **Zero Branch Pollution**: Sub-agents never touch or commit directly to the user's active branch.
- **Dedicated Worktrees**: Tasks execute inside `~/.krypton/worktrees/<task-id>/` on branch `krypton/<task-id>`.
- **Atomic Semantic Commits**: Successful sub-steps generate Conventional Commits (`feat(agent): ...`).
- **Deterministic Hard Rollback**: If verification fails, immediately executes `git reset --hard <last_verified_commit>`.
- **Visual Merge Gateway**: User audits changes in `VcsDiffViewer` before merging into active branch.

### E. Stealth Browser Automation & AXTree (`src/browser/`)
- **Context Pooling**: Enforces hard limit of 2 active browser contexts; 15-minute idle cleanup.
- **Accessibility Tree Blind Navigation (`axtree.ts`)**:
  - Uses Chrome DevTools Protocol (CDP) `Accessibility.getFullAXTree`.
  - Prunes non-interactive layout nodes and assigns transient numeric IDs (`[id=1]`, `[id=2]`).
  - Condenses 5MB / 100,000 token DOM trees into 2KB / 400 token semantic snapshots.
- **Humanized Interaction**: Bézier mouse movement curves, Gaussian keypress delays (60–140ms), visual agent cursor badge.

### F. Context Optimization & HITL Bus (`src/context/`, `src/interaction/`)
- **Observation Masking**: Tool stdout > 1,500 tokens is offloaded to `~/.krypton/cache/outputs/` with only a 50-line head/tail summary in prompt context.
- **Context Compaction**: When prompt utilization exceeds 90%, compresses history into state checkpoints.
- **Interaction Bus**: Dispatches clarification prompts and high-priority tool approval gates to the user.

---

## 6. Storage, Secret Vault & State Persistence (`~/.krypton`)

The host storage hierarchy is strictly partitioned across machine configs, pure prompts, encrypted secrets, and ephemeral workspaces:

```
~/.krypton/
├── config.json                     # Machine configuration (global settings, initialized flag)
├── vault.enc                       # AES-256-GCM encrypted credential vault (fallback)
│
├── agents/                         # Agent workspace definitions
│   └── <agent-name>/
│       ├── config.json             # Machine config (model, temperature, tools, token budget)
│       ├── IDENTITY.md             # Persona and system definition
│       ├── SOUL.md                 # Behavioral boundaries and ethical guardrails
│       ├── AGENTS.md               # Coding conventions and repository standards
│       ├── USER.md                 # User profile and preferences
│       ├── MEMORY.md               # Long-term cross-session knowledge memory
│       ├── TODO.md                 # Active TaskTree DAG synchronized ledger
│       ├── BOOTSTRAP.md            # First-run onboarding instructions
│       └── short_term/
│           ├── events.jsonl        # Append-only event-sourcing journal
│           └── trajectories/       # Session audit traces (<sessionId>.json)
│
├── worktrees/                      # Isolated Git worktrees (<task-id>/)
├── sandbox_workspace/              # Ephemeral sandbox directories (<exec-id>/)
├── browser_profiles/               # Stealth browser session profiles & cookies
└── cache/
    └── outputs/                    # Masked tool stdout log files
```

### Secret Vault & Credential Security
- **Native OS Keyring**: Primary credential storage via Windows Credential Manager, macOS Keychain, or Linux Secret Service.
- **Cryptographic File Fallback**: `~/.krypton/vault.enc` encrypted using AES-256-GCM with PBKDF2 key derivation when native keyrings are unavailable.

---

## 7. Single-Artifact Distribution & Build System

Krypton adheres to the strict **1 OS = 1 Package** distribution rule (`AGENTS.md`):

| Operating System | Output Artifact | Bundling Mechanics |
| :--- | :--- | :--- |
| **Windows** | `Krypton-Setup-<version>.exe` | NSIS single installer embedding `krypton-daemon.exe` and `krypton-cli.exe` sidecars. |
| **macOS** | `Krypton-<version>.dmg` | Apple Disk Image containing unified `.app` bundle with embedded sidecars in `Contents/Resources/binaries/`. |
| **Linux** | `Krypton-<version>.AppImage` | Self-contained AppImage with runtime sidecars in `$APPDIR/usr/bin/`. |

---

## 8. Verification & Architectural Governance

All changes to Krypton must adhere to the **Four Golden Operational Rules** in [`AGENTS.md`](../../AGENTS.md):
1. **Pre-Flight Audit & Planning**: Always read docs in `docs/` and formulate an explicit implementation plan before modifying code.
2. **Execution & Zero-Error Testing**: All modifications must pass `pnpm run typecheck`, `pnpm run test:all`, and `cargo check`.
3. **CI/CD Synchronization**: GitHub Actions workflows in `.github/workflows/` must mirror local build standards.
4. **Mandatory Documentation Maintenance (Zero-Drift Policy)**: All architectural updates must be documented immediately in `docs/` and indexed in `docs/INDEX.md`.
