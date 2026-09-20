# System Topology & Architecture

This document defines the high-level system topology, package map, and process communication boundaries of **Krypton**, a local-first autonomous desktop AI agent runtime.

---

## 1. High-Level Architectural Topology

Krypton operates as a decentralized, local-first runtime with zero external server dependencies:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DESKTOP SHELL (Tauri v2)                      │
│                                                                         │
│  ┌───────────────────────────────┐     ┌─────────────────────────────┐  │
│  │   Primary Dashboard Window    │     │   Krypton Synapse Window    │  │
│  │   (React 19 / Next.js 16)     │     │   (Transparent / Frameless) │  │
│  └──────────────┬────────────────┘     └──────────────┬──────────────┘  │
│                 │                                     │                 │
│                 └─────────────────┬───────────────────┘                 │
│                                   │ Native Tauri IPC                    │
│                                   ▼                                     │
│                     ┌───────────────────────────┐                       │
│                     │  Tauri Rust Core Backend  │                       │
│                     │  (Sidecar Supervisor)     │                       │
│                     └─────────────┬─────────────┘                       │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │ Spawns & Monitors
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND DAEMON ENGINE (krypton-daemon)            │
│                    Node.js / Bun Standalone Binary                      │
│                                                                         │
│  ┌───────────────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │ Named Pipe / Socket   │  │ WebSocket Server   │  │ JSON-RPC 2.0   │  │
│  │ (IPC Endpoint)        │  │ (ws://127.0.0.1)   │  │ Dispatcher     │  │
│  └──────────┬────────────┘  └─────────┬──────────┘  └────────────────┘  │
│             │                         │                                 │
│             ▼                         ▼                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Core Engine: Actor Runtime, Dynamic Task Planner, VCS Worktrees,   │  │
│  │ AST Sandboxing, Context Compactor, MCP Host, Stealth Browser       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Platform Named Pipe / Domain Socket
┌───────────────────────────────────┴─────────────────────────────────────┐
│                    TERMINAL CLIENT COMPANION (krypton-cli)              │
│                    React + Ink Interactive Terminal UI                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Package Map

Krypton is organized as a pnpm workspace with composite TypeScript and Rust packages:

| Path | Package Name | Role | Technology Stack |
| :--- | :--- | :--- | :--- |
| `packages/shared-types` | `@krypton/shared-types` | Single source of truth for contracts, types & Zod schemas | TypeScript, Zod |
| `packages/agent-runtime` | `@krypton/agent-runtime` | Autonomous agent engine, daemon, MCP host, sandbox | TypeScript, Bun / Node.js |
| `packages/cli` | `@krypton/cli` | Standalone terminal client with interactive task TUI | React 18, Ink, Commander |
| `apps/desktop` | `desktop` | Native desktop application shell & floating HUD | Tauri v2, Rust, Next.js 16 |
| `scripts/` | — | Cross-platform standalone binary compilers & bundlers | Node.js, Bun |

---

## 3. Inter-Process Communication (IPC) Channels

### A. Rust Native Core ⇄ Background Daemon
- **Supervision**: Rust launches the standalone `krypton-daemon` binary as a managed child process (`apps/desktop/src-tauri/src/commands/sidecar.rs`).
- **Ping & Diagnostics**: Rust queries daemon liveness via local IPC sockets and validates process health.

### B. Desktop UI & CLI ⇄ Background Daemon
- **Windows Named Pipe**: `\\.\pipe\krypton-ipc` (ultra-low-latency local IPC).
- **POSIX Domain Socket**: `/tmp/krypton.sock` (macOS and Linux socket).
- **WebSocket Streaming**: `ws://127.0.0.1:18789` for real-time token streaming (`token_stream`), log events (`agent_log`), and task DAG mutations (`task_tree_updated`).
- **JSON-RPC 2.0**: Standardized request/response wire protocol for method invocation across all channels.

---

## 4. Architectural Boundaries & Invariants

1. **Zero Direct Branch Pollution**: Autonomous coding agents never modify user branches directly; all work occurs in isolated Git worktrees.
2. **Strict Configuration Decoupling**: Configuration (`config.json`) is never intermingled with prompt markdown files (`IDENTITY.md`, `SOUL.md`).
3. **AST-Prechecked Execution**: Every generated script passes through AST static validation prior to running inside restricted OS sandboxes.
4. **Bounded Recursion**: Sub-agent delegation enforces hard depth (`<= 3`) and concurrency (`<= 5`) ceilings to avoid infinite recursion.
