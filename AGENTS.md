# Krypton — Autonomous Desktop AI Agent Runtime
## Repository Guidelines & Agent Operating System (AGENTS.md)

This file defines the mandatory operational principles, architectural standards, safety boundaries, and engineering conventions for all AI agents and contributors working inside the **Krypton** codebase.

---

## 1. Project Overview & System Architecture

Krypton is a local-first, cross-platform autonomous desktop AI runtime designed to operate with zero server lock-in. It combines a native desktop shell with a recursive background daemon and dynamic tool synthesis.

### High-Level Topology
- **Desktop Shell (`apps/desktop`)**: Hybrid **Tauri v2 (Rust)** core with a **React 19 / Next.js** dashboard and an always-on-top, frameless, translucent floating **Voice Micro-HUD**.
- **Daemon Runtime (`packages/agent-runtime`)**: High-performance **TypeScript (Node.js/Bun)** background engine compiled into a single-binary Tauri sidecar (`krypton-daemon`).
- **Shared Contracts (`packages/shared-types`)**: Single source of truth for interfaces, Zod validation schemas, IPC protocols, and event-sourcing types.
- **Terminal Companion (`packages/cli`)**: Standalone terminal client built with **React + Ink**, providing an interactive TUI for task DAGs and HITL inputs.
- **Runtime Environment (`~/.krypton`)**: OS-native folder (`%USERPROFILE%\.krypton` on Windows, `$HOME/.krypton` on macOS/Linux) storing configs, credentials, logs, agent memory, and Git worktrees.

---

## 2. Monorepo Structure & Package Map

```
krypton/
├── apps/
│   └── desktop/                  # Tauri v2 (Rust) + React/Next.js frontend
│       ├── src-tauri/            # Rust native backend, sidecar supervisor, audio & hotkeys
│       └── src/                  # Next.js workspace dashboard & Voice Micro-HUD
├── packages/
│   ├── shared-types/             # Universal TypeScript types, Zod schemas, IPC definitions
│   ├── agent-runtime/            # Core agent actor engine, MCP host, sandbox, browser, VCS
│   └── cli/                      # Standalone Ink/React terminal CLI
├── scripts/                      # Standalone binary compiler and packaging scripts
├── .idea/                        # System specifications (idea.md) and master roadmap (TODO.md)
├── pnpm-workspace.yaml           # Monorepo workspace configuration
├── package.json                  # Root monorepo manifest
└── tsconfig.base.json            # Base TypeScript configuration
```

---

## 3. Strict Engineering Directives for Agents

### A. Package Management & Tooling
- **Package Manager**: Use `pnpm` exclusively. Never run `npm` or `yarn`.
- **Workspace Filtering**: Target specific packages using `pnpm --filter <pkg-name> <command>` (e.g., `pnpm --filter @krypton/shared-types build`).
- **Dependencies**: Never install duplicate dependencies in sub-packages if they belong in workspace root. Shared types must always be imported from `@krypton/shared-types`.

### B. Type Safety & Contracts
- **Zero Drift**: Any change to data structures, task models, or IPC payloads **must** be implemented in `packages/shared-types` first.
- **Runtime Validation**: Accompany TypeScript interfaces with corresponding `zod` schemas for all boundary crossings (IPC, WebSocket, CLI pipes, LLM tool inputs).
- **Strict TypeScript**: Never use `any` without an explicit, documented architectural justification. Use `unknown` with type guards or Zod validation.

### C. Version Control & Git Worktrees (Krypton-VCS)
- **Worktree Isolation**: Automated agent coding tasks must execute inside an isolated Git worktree under `~/.krypton/worktrees/<task-id>`.
- **No Direct Branch Pollution**: Never modify or commit directly to the active working branch during autonomous tasks.
- **Atomic Semantic Commits**: Every completed sub-task step must produce an atomic Conventional Commit (`feat(agent): ...`, `fix(vcs): ...`).
- **Deterministic Rollback**: If a verification step (linter, compiler, test suite) fails, immediately execute a hard rollback (`git reset --hard`) to the last verified commit hash.
- **Merge Gateway**: Merging an agent worktree back into the main branch requires explicit human approval via the visual diff viewer.

### D. Sub-Agent Recursion & Concurrency Limits (Failure Mode Defense)
- **Recursion Ceiling**: Enforce a strict maximum recursion depth: `max_depth <= 3`. Agents at depth 3 must never invoke `spawnChild()`.
- **Global Concurrency Cap**: Allow a maximum of 5 concurrently executing sub-agents across the entire runtime. Queue subsequent tasks.
- **Token Budgeting**: Every sub-agent must receive a finite, explicit token budget from its parent. If the budget is exhausted, terminate cleanly.
- **Execution Timeouts**: Bind every sub-agent process to a parent `AbortController` (default 60s per child task).

### E. Dynamic Code Sandboxing & AST Safety (Failure Mode Defense)
- **Static AST Linter**: Before running any synthesized Python or TypeScript code, pass it through the static AST linter (`packages/agent-runtime/src/sandbox/linter.ts`).
- **Banned Operations**: Block hazardous system commands: `rm -rf /`, `del /s /q`, `child_process.exec`, `child_process.spawn`, `os.system`, `subprocess.Popen`, dynamic `eval()`, and raw root disk writes.
- **Subprocess Jail**: Run scripts inside OS-constrained subprocesses:
  - Windows: Constrained within Windows Job Objects (CPU and 512MB RAM caps).
  - macOS/Linux: Constrained via `posix_spawn` / `rlimit` (RLIMIT_AS, RLIMIT_CPU).
- **Ephemeral Workspaces**: Execute scripts strictly within `~/.krypton/sandbox_workspace/<exec-id>`.

### F. Context Optimization & Output Offloading (Failure Mode Defense)
- **Observation Masking**: If a tool output or execution stdout exceeds 1,500 tokens (~6KB), offload the raw content to `~/.krypton/cache/outputs/run_step_<id>.log`. Inject only a 50-line head/tail summary with line count and file path into the model context.
- **Context Compaction**: Monitor token consumption. When prompt utilization exceeds 90%, condense conversation history into a distilled state checkpoint, retaining only the objective, task DAG, and active diff references.

### G. Stealth Browser Automation (Failure Mode Defense)
- **Browser Context Pooling**: Enforce a hard maximum of 2 active browser contexts at any time in `BrowserContextPool`.
- **Idle Recycling**: Automatically close and clean up browser contexts idle for >15 minutes.
- **Accessibility-First Navigation**: Prioritize Chrome DevTools Protocol Accessibility Tree (AXTree) blind navigation over vision models. Use transient numeric IDs (`[id=1]`, `[id=2]`). Vision is only a fallback.
- **Humanized Interaction**: Generate cubic Bézier mouse movement curves with micro-jitter and Gaussian keypress delays (60–140ms). Injected cursor must display the active agent name.

### H. Human-in-the-Loop (HITL) Protocol
- **Ambiguity Gate**: When instructions are ambiguous or high-risk operations are requested, dispatch a structured `ClarificationRequest`.
- **Multi-Channel Dispatch**: Broadcast prompts to Desktop UI (modal), CLI (arrow-key selector), Voice HUD (transcription), and messaging channels.
- **Non-Blocking Resolution**: The first valid answer from any channel unblocks execution and cancels prompts on other channels.

---

## 4. Per-Agent Workspace Conventions (`~/.krypton/agents/<name>/`)

Every agent instance strictly decouples machine-readable configuration from human/LLM context:
- **`config.json`**: Dedicated exclusively to machine-readable configuration, agent settings, model parameters, API provider references, tool declarations, permissions, recursion limits, token budget, and runtime metadata. Markdown files MUST NOT contain configuration keys or application settings.
- **`IDENTITY.md`**: Pure agent persona and system prompt instructions (who the agent is, creature, vibe, avatar, instructions). Contains zero configuration keys.
- **`SOUL.md`**: Immutable character and reasoning directives, core truths, and behavioral guardrails.
- **`AGENTS.md`**: Operational workspace conventions, memory guidelines, group chat rules, and environment notes.
- **`USER.md`**: Durable user preferences, communication style, and profile directives.
- **`MEMORY.md`**: Distilled long-term knowledge, verified facts, architectural decisions, and curated lessons learned.
- **`TODO.md`**: Live, human-readable state of the agent's active task DAG and permanent historical task log.
- **`BOOTSTRAP.md`**: First-run onboarding ritual (auto-cleared after setup).
- **`short_term/`**: Append-only storage for transcripts, `events.jsonl` (event store), and verified trajectories (`trajectories/`).

---

## 5. Standard Build & Development Commands

```bash
# Install dependencies across all monorepo workspaces
pnpm install

# Typecheck and build shared contracts
pnpm --filter @krypton/shared-types build

# Start desktop development (Next.js frontend + Tauri shell)
pnpm --filter desktop dev

# Build Next.js frontend production bundle
pnpm --filter desktop build

# Check Rust native backend code
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml

# Run daemon in development mode
pnpm --filter @krypton/agent-runtime dev

# Compile standalone sidecar binary
node scripts/build-sidecar.mjs

# Compile standalone CLI binary
node scripts/build-cli.mjs
```

---

## 6. Communication & Documentation Rules
- Reference exact relative paths (e.g., `packages/shared-types/src/agent.ts`).
- When proposing multi-step implementations, consult and update `.idea/TODO.md`.
- Never commit credentials, private keys, or session tokens; always route through `packages/agent-runtime/src/providers/vault.ts`.
