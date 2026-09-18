# Krypton — Autonomous Agent Operating System Protocol (AGENTS.md)

This document establishes the **mandatory operational standard** that every AI agent and human contributor must follow when building, refactoring, testing, and documenting changes in the **Krypton** repository.

---

## 1. The Four Golden Operational Rules

Every AI agent operating in this repository is bound by these four invariant rules:

### 🔴 Rule 1: Pre-Flight Audit & Planning
1. **Never Guess Architecture or Paths**: Before writing or modifying any code, the agent **MUST** inspect the relevant codebase sections and read the matching modular files in `docs/` (consult [`docs/INDEX.md`](docs/INDEX.md) for routing).
2. **Explicit Implementation Plan**: Before executing edits, the agent **MUST** formulate and state a concise, explicit Implementation Plan outlining proposed file modifications, dependency impacts, and verification methods.

### 🔴 Rule 2: Execution, Verification & Zero-Error Testing
1. **Multi-Tier Verification**: After writing or modifying code, the agent **MUST** execute all relevant verification steps:
   - Type-checking across all monorepo packages: `pnpm run typecheck`
   - Automated unit & integration tests: `pnpm run test:all`
   - Rust native core validation: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
   - Direct CLI / daemon execution commands when touching runtime components.
2. **Immediate Error Rectification**: If any compilation error, linter violation, or test failure occurs, the agent **MUST** diagnose the root cause and fix it immediately. Repeat until zero errors and zero diagnostics remain.

### 🔴 Rule 3: CI/CD & GitHub Actions Synchronization
1. **Pipeline Integrity**: Whenever build commands, toolchains, dependencies, CLI binaries, or packaging configurations are changed, the agent **MUST** inspect and update all related workflows in [`.github/workflows/`](.github/workflows/) (`ci.yml`, `release.yml`).
2. **Remote Parity**: Ensure that remote GitHub Actions matrices mirror local build steps and the single-artifact packaging standard.

### 🔴 Rule 4: Mandatory Documentation Maintenance (Zero-Drift Policy)
1. **Real-Time Documentation Updates**: Whenever an agent adds a feature, refactors code, modifies an IPC method, changes a schema, or removes functionality, it **MUST** immediately update the matching modular document in `docs/`.
2. **New Domain Registration**: If a new technical domain or subsystem is introduced, create a new modular markdown file (~100–250 lines) in the appropriate `docs/` subdirectory and immediately register it with a relative link in [`docs/INDEX.md`](docs/INDEX.md).
3. **No Stale Context**: Documentation must reflect the exact reality of the codebase at all times so subsequent AI agents never operate on outdated context.

---

## 2. Core Architectural Guardrails

### A. Monorepo & Package Management
- **Package Manager**: Use `pnpm` exclusively. Never run `npm` or `yarn`.
- **Workspace Filtering**: Target sub-packages with `pnpm --filter <pkg-name> <command>`.
- **Type Source of Truth**: All shared interfaces, Zod schemas, and IPC contracts live in `packages/shared-types`. Any contract modification must happen in `shared-types` first.
- **Strict TypeScript**: Never use `any` without an explicit, documented architectural justification. Use `unknown` with type guards or Zod validation.

### B. Version Control & Worktree Isolation (Krypton-VCS)
- **Worktree Isolation**: Automated agent coding tasks must execute inside an isolated Git worktree under `~/.krypton/worktrees/<task-id>`.
- **No Direct Branch Pollution**: Never modify or commit directly to the user's active branch during autonomous agent operations.
- **Atomic Semantic Commits**: Every verified step produces a Conventional Commit (`feat(agent): ...`, `fix(vcs): ...`).
- **Deterministic Rollback**: If a verification step fails, immediately execute a hard rollback (`git reset --hard`) to the last verified commit hash.
- **Visual Merge Gateway**: Merging an agent worktree into the user branch requires explicit human approval via the visual diff viewer.
- **Issue & Pull Request Linking**: All pull requests and contribution work must link to an associated GitHub issue using standard GitHub keyword syntax (`Fixes #X` or `Closes #X`) in the pull request description.

### C. Sub-Agent Recursion & Concurrency Limits
- **Recursion Ceiling**: Enforce `max_depth <= 3`. Agents at depth 3 must never invoke `spawnChild()`.
- **Global Concurrency Cap**: Maximum of 5 concurrently executing sub-agents across the runtime; surplus tasks are queued.
- **Token Budgeting**: Every sub-agent receives a finite token budget from its parent. If exhausted, terminate cleanly.
- **Execution Timeouts**: Bind child processes to an `AbortController` (default 60s per child task).

### D. Dynamic Code Sandboxing & AST Safety
- **Static AST Linter**: Pass all synthesized TypeScript/JavaScript and Python code through the AST linter (`packages/agent-runtime/src/sandbox/linter.ts`) before execution.
- **Banned Operations**: Block hazardous operations: `rm -rf /`, `del /s /q`, `child_process.exec`, `child_process.spawn`, `os.system`, `subprocess.Popen`, dynamic `eval()`, and raw root disk writes.
- **Subprocess Jail**: Run scripts inside OS-constrained subprocesses (Windows Job Objects / POSIX rlimit).
- **Ephemeral Workspaces**: Execute scripts strictly within `~/.krypton/sandbox_workspace/<exec-id>`.

### E. Context Optimization & Output Masking
- **Observation Masking**: If tool stdout exceeds 1,500 tokens (~6KB), offload raw content to `~/.krypton/cache/outputs/run_step_<id>.log`. Inject only a 50-line head/tail summary with total lines and file path into prompt context.
- **Context Compaction**: When prompt token utilization exceeds 90%, condense conversation history into a distilled state checkpoint retaining objective, task DAG, and active diff references.

### F. Stealth Browser Automation
- **Context Pooling**: Enforce a hard maximum of 2 active browser contexts in `BrowserContextPool`.
- **Idle Recycling**: Automatically close and clean up browser contexts idle for >15 minutes.
- **AXTree Navigation**: Prioritize Chrome DevTools Protocol Accessibility Tree blind navigation with transient numeric IDs (`[id=1]`) over vision models. Vision is only a fallback.
- **Humanized Interaction**: Generate cubic Bézier mouse movement curves and Gaussian keypress delays (60–140ms). Injected cursor must display active agent name.

### G. Per-Agent Workspace Schema (`~/.krypton/agents/<name>/`)
- **Strict Decoupling**: Configuration is strictly decoupled from prompt markdown files.
- **`config.json`**: Dedicated exclusively to machine configuration (model, provider, tools, permissions, token budget). Markdown files MUST NOT contain configuration keys or frontmatter settings.
- **Markdown Context (`*.md`)**: `IDENTITY.md` (persona), `SOUL.md` (guardrails), `AGENTS.md` (conventions), `USER.md` (user model), `MEMORY.md` (long-term memory), `TODO.md` (task DAG ledger), `BOOTSTRAP.md` (first-run onboarding).

### H. Single-Artifact Distribution Rule
- **1 OS = 1 Package**: Every OS release produces **EXACTLY ONE** installer/image (Windows NSIS `.exe`, macOS `.dmg`, Linux `.AppImage`).
- **Embedded Sidecars**: Both `krypton-daemon` and `krypton-cli` are embedded directly inside the desktop application package. Loose daemons, WiX MSI installers, and intermediate CLI binaries are strictly suppressed.

---

## 3. Standard Build & Development Commands

```bash
# Validate host environment prerequisites
node scripts/setup-env.mjs

# Install dependencies across all monorepo workspaces
pnpm install

# Build shared contracts, daemon runtime, and CLI
pnpm run build

# Compile standalone native sidecars (krypton-daemon & krypton-cli)
pnpm run build:binaries

# Typecheck all TypeScript packages
pnpm run typecheck

# Run full monorepo test suite & Cargo check
pnpm run test:all

# Launch desktop app in development mode
pnpm run dev:tauri

# Run daemon in standalone development mode
pnpm run dev:daemon

# Package desktop application & harvest unified release installer
pnpm run build:desktop
```
