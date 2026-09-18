# CLI Client Architecture & Terminal Companion

This document covers the standalone React + Ink terminal client (`krypton-cli`), command routers, IPC connection, interactive TUIs, and PATH registration in **Krypton**.

---

## 1. Terminal Client Overview (`packages/cli/`)

Krypton provides an interactive terminal companion client designed for developers who prefer working directly inside a shell:
- **Interactive TUI**: Built with **React 18 + Ink** for terminal rendering.
- **Standalone Binary**: Compiles via Bun (`bun build --compile`) into a single executable (`krypton` / `krypton.exe`).
- **Autonomous Daemon Spawning**: If the background daemon is not currently active, the CLI launches it headlessly in the background.

---

## 2. Command Routing (`index.ts`)

The CLI provides intuitive commands configured via Commander:

| Command | Arguments / Flags | Description |
| :--- | :--- | :--- |
| `krypton run` | `"<instruction>"` | Dispatches a goal to the orchestrator agent and renders the live Task DAG. |
| `krypton vcs diff` | `[--worktree <id>]` | Renders a syntax-highlighted terminal diff of pending worktree changes. |
| `krypton vcs merge` | `[--worktree <id>]` | Approves and fast-forwards worktree changes into the working branch. |
| `krypton vcs rollback`| `[--worktree <id>]` | Hard-resets the worktree to the last verified commit. |
| `krypton agents list` | — | Lists registered agents, active models, and token budgets. |
| `krypton tools list` | — | Lists discovered MCP and synthesized tools. |

---

## 3. Interactive Terminal Components (`packages/cli/src/ui/`)

### A. TaskListView (`TaskListView.tsx`)
Renders the live hierarchical Task DAG directly in the terminal:
- Animated spinners on active tasks.
- Visual status glyphs: `✔` completed (green), `✖` failed (red), `⏳` pending (yellow).
- Sub-agent thought traces and live streaming token output.

### B. QuestionPrompt (`QuestionPrompt.tsx`)
Interactive Human-in-the-Loop clarification widget:
- Select choices using keyboard arrows (`↑` / `↓`) or hotkey numbers (`1`, `2`, `3`).
- Custom freeform text entry field.
- Submitting writes the answer back to the daemon over local IPC.

---

## 4. Platform IPC Client (`ipc-client.ts`)

The CLI communicates with the background daemon through local pipes:
- **Windows**: `\\.\pipe\krypton-ipc`
- **Unix (macOS/Linux)**: `/tmp/krypton.sock`
- Protocol: Newline-delimited JSON-RPC 2.0 requests and responses.

---

## 5. PATH Registration & Installation (`installer.rs`)

When the desktop app launches, or when running `scripts/install.ps1` / `scripts/install.sh`, the standalone `krypton` binary is copied to `~/.krypton/bin/` and automatically appended to the user's system `PATH`.
