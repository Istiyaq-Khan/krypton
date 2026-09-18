# Krypton Modular Documentation Suite — Master Index

Welcome to the **Krypton** documentation suite. This index serves as the master routing guide for human engineers and AI coding agents.

Each document is modular, highly focused (~100–250 lines), and token-efficient, allowing AI agents to load specific technical context on demand without polluting or overflowing their context windows.

---

## 🧭 Documentation Navigation Map

```
docs/
├── INDEX.md                                # Master routing directory (This file)
│
├── 🏛 Architecture & Lifecycle
│   ├── [System Topology](architecture/system-topology.md)             # Monorepo packages, process tree, IPC
│   ├── [Process Lifecycle](architecture/process-lifecycle.md)         # Startup, sidecar supervision, teardown
│   └── [Actor Engine](architecture/actor-engine.md)                   # Universal Actor loop, recursion caps, event sourcing
│
├── 🖥 Desktop UI & Frontend
│   ├── [Window Controls & Titlebar](desktop/window-controls-titlebar.md) # Frameless architecture, drag regions, window IPC
│   ├── [Views & Routing](desktop/views-and-routing.md)                 # Next.js 16 app router, dashboard, overlay, CSS tokens
│   ├── [First-Run Setup](desktop/first-run-setup.md)                   # Setup wizard lifecycle, configuration persistence
│   ├── [Desktop IPC & Hooks](desktop/ipc-and-hooks.md)                 # Tauri Rust command handlers, useKryptonDaemon hook
│   ├── [Voice Micro-HUD](desktop/voice-micro-hud.md)                   # Translucent floating overlay, global hotkeys, STT
│   └── [Components Catalog](desktop/components-guide.md)               # Core UI component catalog & visual state machines
│
├── ⚙ Runtime & Daemon Engine
│   ├── [Daemon Architecture](runtime/daemon-architecture.md)           # Platform pipes, WebSocket streaming, JSON-RPC 2.0
│   ├── [Task DAG Planner](runtime/task-dag-planner.md)                 # TaskTree DAG, dependency resolution, replanner
│   ├── [Sandboxing & AST Safety](runtime/sandboxing-and-security.md)   # AST safety linter, Windows Job Objects/rlimit jail
│   ├── [Context Optimization](runtime/context-optimization.md)         # Tool output offloading (>1,500 tokens), compaction (>90%)
│   ├── [Krypton-VCS](runtime/krypton-vcs.md)                           # Isolated Git worktrees, semantic commits, rollback
│   ├── [Browser Automation](runtime/browser-automation.md)             # Stealth Playwright/CDP pool, AXTree blind navigation
│   ├── [Tools & MCP Host](runtime/tools-and-mcp.md)                    # Model Context Protocol host, stdio/SSE transports
│   ├── [Interaction Bus (HITL)](runtime/interaction-bus.md)            # Multi-channel clarification prompt dispatch & resolution
│   ├── [Terminal & OS Automation](runtime/terminal-and-os.md)          # Persistent PTY pool, ANSI cleaner, Tree-sitter, LSP
│   └── [Omni-Channel Gateway](runtime/channels-gateway.md)             # Telegram, Discord, WhatsApp, Slack, Signal messaging
│
├── 📁 Storage & Configuration
│   ├── [Storage Schemas](config/storage-schemas.md)                    # Cross-platform ~/.krypton filesystem layout
│   ├── [Agent Workspace Specs](config/agent-workspace-specs.md)        # config.json machine schema vs pure markdown context
│   └── [Secret Vault & Keyring](config/vault-and-credentials.md)       # Native OS keyring integration, AES-256-GCM encryption
│
├── 💻 Terminal Client Companion
│   └── [CLI Architecture](cli/cli-architecture.md)                     # React + Ink terminal UI, command router, IPC client
│
├── 📦 Build, CI/CD & Distribution
│   ├── [Single-Artifact Standard](ci-cd/single-artifact-standard.md)   # 1 OS = 1 Package rule, embedded sidecars
│   ├── [Build Pipelines](ci-cd/build-pipelines.md)                     # Monorepo build commands, binary compilation scripts
│   └── [GitHub Actions CI/CD](ci-cd/github-actions.md)                 # CI test workflow matrix, release workflow, issue/PR templates
│
└── 📜 Historical & Hardening References
    ├── [Agent Storage Architecture](AGENT_STORAGE_ARCHITECTURE.md)     # Architectural specification for agent workspaces
    ├── [Production Hardening](PRODUCTION_HARDENING.md)                 # Frameless window unification & mock data purge
    └── [Release Architecture](RELEASE_ARCHITECTURE.md)                 # Single-artifact bundling & packaging mechanics
```

---

## 🎯 Quick Routing by Concern

| If you need to... | Read this document |
| :--- | :--- |
| **Understand overall system topology and packages** | [`architecture/system-topology.md`](architecture/system-topology.md) |
| **Inspect or modify how daemon is supervised** | [`architecture/process-lifecycle.md`](architecture/process-lifecycle.md) |
| **Work on Actor loop, sub-agent recursion, or budgets**| [`architecture/actor-engine.md`](architecture/actor-engine.md) |
| **Add or adjust desktop UI titlebar and window controls**| [`desktop/window-controls-titlebar.md`](desktop/window-controls-titlebar.md) |
| **Edit desktop dashboard, routing, or CSS design tokens**| [`desktop/views-and-routing.md`](desktop/views-and-routing.md) |
| **Modify onboarding wizard or initial configuration** | [`desktop/first-run-setup.md`](desktop/first-run-setup.md) |
| **Inspect Tauri IPC commands or React hooks** | [`desktop/ipc-and-hooks.md`](desktop/ipc-and-hooks.md) |
| **Work on the floating Voice Micro-HUD overlay** | [`desktop/voice-micro-hud.md`](desktop/voice-micro-hud.md) |
| **Review UI components (Chatbar, Stream, DiffViewer)** | [`desktop/components-guide.md`](desktop/components-guide.md) |
| **Add or update JSON-RPC methods or WebSocket events** | [`runtime/daemon-architecture.md`](runtime/daemon-architecture.md) |
| **Modify TaskTree DAG scheduling or replanning** | [`runtime/task-dag-planner.md`](runtime/task-dag-planner.md) |
| **Enhance AST security linter or sandbox runner** | [`runtime/sandboxing-and-security.md`](runtime/sandboxing-and-security.md) |
| **Configure large tool output masking or compaction** | [`runtime/context-optimization.md`](runtime/context-optimization.md) |
| **Work on Git worktrees, semantic commits, or diffs** | [`runtime/krypton-vcs.md`](runtime/krypton-vcs.md) |
| **Adjust stealth browser pooling or AXTree navigation** | [`runtime/browser-automation.md`](runtime/browser-automation.md) |
| **Connect external MCP servers or register tools** | [`runtime/tools-and-mcp.md`](runtime/tools-and-mcp.md) |
| **Manage HITL clarification questions or prompts** | [`runtime/interaction-bus.md`](runtime/interaction-bus.md) |
| **Work on persistent PTY terminal or Tree-sitter** | [`runtime/terminal-and-os.md`](runtime/terminal-and-os.md) |
| **Add chat adapters (Telegram, Discord, WhatsApp)** | [`runtime/channels-gateway.md`](runtime/channels-gateway.md) |
| **Inspect system directories or config.json format** | [`config/storage-schemas.md`](config/storage-schemas.md) |
| **Manage agent workspace files (IDENTITY, SOUL, MEMORY)**| [`config/agent-workspace-specs.md`](config/agent-workspace-specs.md) |
| **Store or retrieve encrypted API keys securely** | [`config/vault-and-credentials.md`](config/vault-and-credentials.md) |
| **Develop or debug the React+Ink terminal client** | [`cli/cli-architecture.md`](cli/cli-architecture.md) |
| **Understand single-installer packaging per OS** | [`ci-cd/single-artifact-standard.md`](ci-cd/single-artifact-standard.md) |
| **Run local builds or cross-compile sidecars** | [`ci-cd/build-pipelines.md`](ci-cd/build-pipelines.md) |
| **Inspect or update GitHub Actions CI/CD workflows** | [`ci-cd/github-actions.md`](ci-cd/github-actions.md) |

---

## ⚡ Zero-Drift Policy

Every AI agent working on Krypton must follow the **Zero-Drift Policy** defined in [`AGENTS.md`](../AGENTS.md):
- Whenever code, interfaces, schemas, or behaviors change, update the matching document above.
- If creating a new domain, add its document to `docs/` and register it in this index immediately.
