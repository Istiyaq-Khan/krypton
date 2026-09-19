<div align="center">

# ⚡ Krypton
### Autonomous Desktop AI Agent Runtime

**Local-first • Zero Server Lock-in • Native Desktop Shell • Recursive Actor Model • Stealth Browser • Omni-Channel Gateway**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.98+-DEA584.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

</div>

## 🌟 Overview

**Krypton** is a local-first, cross-platform autonomous desktop AI agent runtime designed to operate with zero server lock-in. It combines a native desktop shell with a recursive background daemon, isolated Git worktree execution, stealth browser automation, and an omni-channel messaging gateway.

Everything Krypton does is stored locally on your machine inside `~/.krypton` (`%USERPROFILE%\.krypton` on Windows, `$HOME/.krypton` on macOS/Linux).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KRYPTON UNIFIED RUNTIME                         │
├───────────────────────────────┬────────────────────────────────────────┤
│     Native Desktop Shell      │        Background Daemon Engine        │
│  • Tauri v2 (Rust) core       │  • Recursive Actor Engine (depth <= 3) │
│  • React 19 / Next.js UI      │  • Task DAG Planner & Dynamic Replanner│
│  • Floating Voice Micro-HUD   │  • Git Worktree Isolation (Krypton-VCS)│
│  • Context-staging Chatbar    │  • Sandboxed Subprocess Runner         │
├───────────────────────────────┼────────────────────────────────────────┤
│     Terminal CLI Companion    │          Omni-Channel Gateway          │
│  • React + Ink dynamic TUI    │  • Telegram (grammY + inline buttons)  │
│  • Live Task DAG spinners     │  • Discord (Discord.js + ActionRows)   │
│  • Interactive HITL prompts   │  • WhatsApp (@whiskeysockets/baileys)  │
│  • Native single-binary CLI   │  • Slack (Block Kit) & Signal (CLI)    │
└───────────────────────────────┴────────────────────────────────────────┘
```

---

## ⚡ 1-Step Quickstart Installation

Krypton installs everything into a single, clean directory (`~/.krypton`) and automatically configures your system `PATH`. Run the single command for your platform:

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/Istiyaq-Khan/krypton/master/scripts/install.ps1 | iex
```
*(Or clone this repository and run `.\scripts\install.ps1`)*

### macOS & Linux (Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/Istiyaq-Khan/krypton/master/scripts/install.sh | bash
```
*(Or clone this repository and run `./scripts/install.sh`)*

### What the 1-Step Installer Does:
1. Provisions `~/.krypton/` (agents, worktrees, cache, browser profiles).
2. Places the standalone `krypton` binary in `~/.krypton/bin/`.
3. Adds `~/.krypton/bin` to your user `PATH` environment variable.
4. Initializes default agent workspace and configuration.

Now, open any terminal and start using Krypton:
```bash
krypton --help
```

---

## 🚀 Key Features

### 1. 🎙️ Floating Voice Micro-HUD & Desktop Chatbar
- **Global Hotkey** (`Ctrl+Shift+Space` or `Cmd+Shift+Space`) summons an always-on-top, translucent, borderless Voice HUD.
- **Zero-Latency Audio**: Stream audio directly to local Whisper.cpp / Parakeet v3 speech-to-text with reactive audio waveform visualization.
- **Desktop Chatbar Console**: Floating bottom console featuring lexical triggers (`/` for dynamic tools, `@` for codebase context), smart paste chip staging ($\ge 10$ lines or $\ge 300$ chars), and full keyboard navigation.

### 2. 🌿 Krypton-VCS: Git Worktree Isolation
- **No Branch Pollution**: Agent coding tasks execute strictly in isolated Git worktrees under `~/.krypton/worktrees/<task-id>`.
- **Atomic Conventional Commits**: Every sub-task step generates an atomic commit (`feat(...)`, `fix(...)`).
- **Deterministic Rollback**: If linters, tests, or compilers fail, Krypton executes a hard rollback (`git reset --hard`) to the last verified commit.
- **Visual Diff Viewer**: Interactive side-by-side diff viewer requiring human approval before merging back into your main branch.

### 3. 🌐 Stealth Browser Perception (AXTree-First)
- **Blind Navigation**: Uses Chrome DevTools Protocol Accessibility Tree (AXTree) with transient numeric IDs (`[id=1]`, `[id=2]`) for accurate DOM interactions with minimal token usage.
- **Humanized Anti-Bot**: Generates cubic Bézier mouse movement curves with micro-jitter and Gaussian keypress delays (60–140ms).
- **Resource Protection**: Hard maximum of 2 active browser contexts with automatic idle recycling after 15 minutes.

### 4. 💬 Omni-Channel Gateway
Control Krypton from your favorite messaging platform with full Human-in-the-Loop (HITL) prompt resolution:
- **Telegram**: grammY bot with inline keyboard buttons for prompt approvals.
- **Discord**: Discord.js bot with task-specific threads and ActionRow button components.
- **WhatsApp**: Powered by `@whiskeysockets/baileys` with numbered quick-reply menus for mobile approvals.
- **Slack**: Interactive Block Kit buttons and live Task DAG checklist updates.
- **Signal**: End-to-end encrypted interaction via `signal-cli`.

### 5. 🛡️ Failure Mode Defense & Sandboxing
- **Recursion Ceiling**: Strict maximum depth of 3 (`max_depth <= 3`).
- **Concurrency Cap**: Maximum of 5 concurrent active sub-agents across the runtime.
- **Subprocess Jail**: Scripts executed in OS-constrained subprocesses (Windows Job Objects / POSIX rlimit with 512MB RAM cap).
- **Static AST Linter**: Blocks dangerous operations (`rm -rf /`, `child_process`, `eval()`, `os.system`).
- **Observation Masking**: Tool outputs $>1,500$ tokens are offloaded to disk, injecting only a 50-line summary into model context.

---

## ⌨️ CLI Command Reference

Krypton includes an interactive terminal companion built with **React + Ink**:

| Command | Description |
| :--- | :--- |
| `krypton run "<goal>"` | Starts an autonomous task DAG with dynamic status spinners and interactive HITL prompt handling. |
| `krypton vcs diff` | Reviews uncommitted changes in the current agent worktree with syntax-colored diffs. |
| `krypton vcs merge <id>` | Approves and merges an agent worktree branch into your active branch. |
| `krypton agents list` | Displays configured local agent fleet, assigned models, and tool lists. |
| `krypton agents create <name>` | Provisions a new agent workspace with archetype templates. |
| `krypton tools list` | Lists active Model Context Protocol (MCP) and dynamic synthesized tools. |
| `krypton tools install <name>` | Discovers and installs an MCP tool or runtime extension. |

---

## 📁 Repository Structure

```
krypton/
├── apps/
│   └── desktop/                  # Tauri v2 (Rust) shell + Next.js 16 / React 19 frontend
│       ├── src-tauri/            # Rust native backend, audio capture, global hotkey & sidecar
│       └── src/                  # Next.js workspace dashboard & Voice Micro-HUD
├── packages/
│   ├── shared-types/             # Universal TypeScript types, Zod schemas, and IPC contracts
│   ├── agent-runtime/            # Core actor engine, MCP host, sandbox, browser, VCS, and channels
│   └── cli/                      # Standalone React + Ink terminal client
├── scripts/
│   ├── install.ps1               # 1-step Windows universal installer
│   ├── install.sh                # 1-step macOS / Linux universal installer
│   ├── build-sidecar.mjs         # Native daemon compiler
│   ├── build-cli.mjs             # Standalone CLI compiler
│   └── setup-env.mjs             # Environment prerequisites validator
├── .githooks/                    # Monorepo pre-commit and pre-push verification gates
├── .github/workflows/            # Cross-platform release matrix (Windows, macOS, Linux)
└── pnpm-workspace.yaml           # Monorepo workspace configuration
```

---

## 🛠️ Building From Source

### Prerequisites
- **Node.js**: `v20+`
- **pnpm**: `v10+`
- **Rust & Cargo**: `stable`
- **Git**: `v2.40+`

Validate your environment with:
```bash
node scripts/setup-env.mjs
```

### Installation & Development
```bash
# 1. Install workspace dependencies
pnpm install

# 2. Build shared contracts and packages
pnpm build

# 3. Run all monorepo test suites (114+ tests)
pnpm test:all

# 4. Start the Desktop Shell in development mode
pnpm --filter desktop dev

# 5. Start the Agent Daemon
pnpm --filter @krypton/agent-runtime dev

# 6. Run the CLI in development
pnpm --filter @krypton/cli dev run "Analyze codebase"
```

### Compiling Standalone Native Binaries
```bash
# Compile internal sidecar binaries (daemon & CLI) into apps/desktop/src-tauri/binaries/
pnpm build:binaries

# Build desktop application and collect single unified release package into output/
pnpm build:desktop
```

---

## 🚢 Single-Artifact Release Pipeline

Krypton follows a strict **Single-Artifact Distribution Architecture**: every release produces **EXACTLY ONE** self-contained, user-ready application package per supported operating system. Users never have to guess which intermediate binary or installer to download.

All background daemons (`krypton-daemon`), command-line companions (`krypton-cli`), and runtime dependencies are compiled and bundled directly inside each single installer package.

### Official Release Packages

| Operating System | Single Download Package | Distribution Format | Architecture | Bundled Components |
| :--- | :--- | :--- | :--- | :--- |
| **Windows** | [`krypton-windows-x64-setup.exe`](https://github.com/Istiyaq-Khan/krypton/releases/latest/download/krypton-windows-x64-setup.exe) | Self-Contained NSIS Installer | `x86_64` | Desktop UI + Background Daemon + CLI Engine |
| **macOS** | [`krypton-macos-universal.dmg`](https://github.com/Istiyaq-Khan/krypton/releases/latest/download/krypton-macos-universal.dmg) | Apple Disk Image (DMG) | Universal / Apple Silicon & Intel | Desktop UI + Background Daemon + CLI Engine |
| **Linux** | [`krypton-linux-x86_64.AppImage`](https://github.com/Istiyaq-Khan/krypton/releases/latest/download/krypton-linux-x86_64.AppImage) | Universal AppImage | `x86_64` | Desktop UI + Background Daemon + CLI Engine |

> Each release publishes cryptographic verification hashes in [`SHA256SUMS.txt`](https://github.com/Istiyaq-Khan/krypton/releases/latest/download/SHA256SUMS.txt).  
> For technical details on sidecar bundling, runtime path resolution, and CI/CD matrices, see [Release Architecture Documentation](docs/RELEASE_ARCHITECTURE.md).

Releases are published automatically to the **[Releases](https://github.com/Istiyaq-Khan/krypton/releases)** tab when a version tag (`v*`) is pushed or manually triggered via `workflow_dispatch`.

---

## 🤝 Contributing

Contributions are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, environment setup, testing standards, and the pull request submission process.

---

## 🔒 Security

For vulnerability reporting guidelines, SLA details, and our local-first defense-in-depth security model, please refer to our [Security Policy](SECURITY.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

