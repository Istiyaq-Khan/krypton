# Krypton: Master Architectural Implementation Plan & Roadmap

This document defines the exhaustive, dependency-ordered technical roadmap for **Krypton**, a local-first, cross-platform autonomous desktop AI runtime.

---

## Architectural Principles & Core Constraints

1. **Local-First & OS-Native**: Zero external server lock-in. Configuration, state, session logs, credentials, and Git worktrees reside strictly within the user environment (`~/.krypton`).
2. **Actor-Model Sub-Agent Recursion**: Every sub-agent is a full universal agent instance with its own context, memory, and bounded delegation caps.
3. **Multi-Channel Human-in-the-Loop (HITL)**: Any ambiguous decision pauses execution and dispatches structured `ClarificationRequest` items to Desktop UI, CLI, Voice HUD, and external channels.
4. **Deterministic Version Control**: All autonomous code modifications take place inside isolated Git worktrees with automatic semantic commits and instant rollback capabilities on verification failure.
5. **Multi-Window Desktop Architecture**: Decoupled Tauri v2 architecture supporting the primary dashboard window and an ultra-low latency, borderless, transparent floating voice HUD.

---

## Implementation Dependency Graph

```
[Phase 1: Shared Core & Type Contracts]
                 │
                 ▼
[Phase 2: Runtime Foundation & OS Sandbox]
                 │
                 ▼
[Phase 3: Recursive Actor Engine, Task Planner & VCS]
                 │
                 ▼
[Phase 4: Perception & Interaction Engine]
                 │
                 ▼
[Phase 5: Desktop App Shell & Micro-HUD]
                 │
                 ▼
[Phase 6: Omni-Channel Gateway & Native Distribution]
```

---

## Phase 1: Shared Core & Type Contracts

**Objective**: Establish the foundation of truth across the monorepo. Define all TypeScript type definitions, Zod validation schemas, IPC protocols, and event contracts before any runtime or UI logic is constructed.

### 1. Monorepo & Package Infrastructure
- [x] Initialize root and workspace configs in [pnpm-workspace.yaml](../pnpm-workspace.yaml) and [package.json](../package.json).
- [x] Configure shared compiler rules in [tsconfig.base.json](../tsconfig.base.json) for strict typing, composite project references, and module resolution.
- [x] Configure package manifest and build scripts in [packages/shared-types/package.json](../packages/shared-types/package.json) targeting modern ESM and DTS output.
- [x] Setup TypeScript configuration in [packages/shared-types/tsconfig.json](../packages/shared-types/tsconfig.json) extending base configs.

### 2. Universal Agent & Context Contracts
- [x] Create core agent data models in [packages/shared-types/src/agent.ts](../packages/shared-types/src/agent.ts):
  - Universal `Message`, `Role` (`system`, `user`, `assistant`, `tool`), `ToolCall`, and `ToolResult` interfaces.
  - `AgentContext` interface tracking agent ID, name, persona metadata, active token budget, current recursion depth, and parent agent ID.
  - `AgentState` enum (`uninitialized`, `idle`, `planning`, `executing`, `awaiting_input`, `compacting`, `verifying`, `completed`, `failed`, `aborted`).
  - `RecursionBoundary` schema enforcing `max_depth` (default <= 3), `max_concurrent_children` (default <= 5), and timeout allocations.
  - `TokenBudget` structure defining hard limits, warning thresholds, and sub-agent allocation shares.

### 3. Task DAG & Planner Contracts
- [x] Define task tree and dynamic DAG models in [packages/shared-types/src/tasks.ts](../packages/shared-types/src/tasks.ts):
  - `TaskNode` model including unique UUID, human-readable title, operational description, assigned agent ID, dependencies (`dependsOn: string[]`), state (`pending`, `in_progress`, `completed`, `failed`, `blocked`), and execution metadata.
  - `TaskTree` DAG container structure supporting topological sorting, cycle detection, and sub-task nesting.
  - `PlanPatch` schema defining dynamic DAG operations: `insertTask`, `removeTask`, `updateDependencies`, `retryTask`, and `markFailed`.
  - Serialization contracts for synchronizing in-memory DAGs to human-readable Markdown format (`TODO.md`).

### 4. MCP & Tool Specification Contracts
- [x] Create Model Context Protocol and local tool contracts in [packages/shared-types/src/mcp.ts](../packages/shared-types/src/mcp.ts):
  - Standard JSON-Schema definitions for MCP Tool definitions matching OpenAI and Anthropic function calling specifications.
  - Transport configuration types: `StdioTransportConfig` (command, args, env, cwd) and `SseTransportConfig` (url, headers, reconnection options).
  - `ToolExecutionRequest` and `ToolExecutionResult` contracts with stdout, stderr, execution duration, and exit status.
  - `SynthesizedToolMetadata` schema tracking ad-hoc synthesized scripts (language, safety linter status, verification state, reusable tag).

### 5. Version Control & Worktree Contracts
- [x] Define Git VCS data structures in [packages/shared-types/src/vcs.ts](../packages/shared-types/src/vcs.ts):
  - `WorktreeContext` schema defining task ID, target repo path, isolated worktree path in `~/.krypton/worktrees/<task-id>`, base commit hash, and branch name (`krypton/<task-id>`).
  - `SemanticCommitMeta` type defining Conventional Commit types (`feat`, `fix`, `refactor`, `test`), task ID reference, and step index.
  - `DiffSummary` and `FilePatch` models capturing added, modified, deleted lines, and merge conflicts.
  - `RollbackRequest` and `MergeApprovalRequest` contracts for human-in-the-loop audit gates.

### 6. Human-in-the-Loop (HITL) Interaction Contracts
- [x] Define clarification schemas in [packages/shared-types/src/interaction.ts](../packages/shared-types/src/interaction.ts):
  - `ClarificationRequest` interface containing request ID, querying agent ID, prompt text, options (`ChoiceOption[]`), allowFreeform boolean, and timeout milliseconds.
  - `ChoiceOption` type containing option ID, display label, description, and keyboard hotkey hint.
  - `ClarificationResponse` interface capturing selected option IDs, custom freeform text, responding channel (`desktop_ui`, `cli`, `voice_hud`, `telegram`, `discord`, `whatsapp`, `slack`, `signal`), and timestamp.

### 7. IPC, RPC & WebSocket Wire Protocols
- [x] Define cross-process event signatures in [packages/shared-types/src/ipc.ts](../packages/shared-types/src/ipc.ts):
  - JSON-RPC 2.0 request/response envelope schemas between Tauri Rust layer, TypeScript Daemon, and CLI client.
  - WebSocket streaming packet types: `TokenStreamChunk`, `AgentLogEvent`, `TaskTreeUpdatedEvent`, `ClarificationRequestedEvent`, `SteeringInputEvent`, `VoiceTranscribedEvent`.
  - Platform-native communication schemas for Windows Named Pipes (`\\.\pipe\krypton-ipc`) and POSIX Domain Sockets (`/tmp/krypton.sock`).

### 8. Event-Sourcing & Trajectory Contracts
- [x] Define event store and trajectory audit contracts in [packages/shared-types/src/events.ts](../packages/shared-types/src/events.ts):
  - Append-only event store record type `KryptonSystemEvent` with discrete event types (`AgentSpawned`, `PlanUpdated`, `ToolExecuting`, `ToolFinished`, `StateCheckpointed`, `CrashResumed`).
  - Trajectory step record schema `TrajectoryStep` (`stepId`, `agentId`, `taskId`, `action`, `observation`, `diffSummary`, `verificationStatus`).
  - Serialization rules for NDJSON (`events.jsonl`).

### 9. Filesystem & Configuration Schemas
- [x] Define system directory and configuration schemas in [packages/shared-types/src/config.ts](../packages/shared-types/src/config.ts):
  - Global configuration schema for `~/.krypton/config.json` (active providers, default model routes, hotkeys, port allocations).
  - Agent workspace specification models for `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, and `BOOTSTRAP.md`.
  - Provider credentials schema for native vault storage.

### 10. Centralized Type Exporter
- [x] Export all types and validation schemas from [packages/shared-types/src/index.ts](../packages/shared-types/src/index.ts).

### Phase 1 Verification Gate
- [x] **Typecheck Execution**: Execute `pnpm --filter @krypton/shared-types run build` (or `tsc --noEmit -p packages/shared-types/tsconfig.json`) to guarantee zero compiler diagnostics.
- [x] **Schema Validation Suite**: Create and execute unit tests in `packages/shared-types/__tests__/schemas.test.ts` validating representative mock payloads against all Zod schemas (validating task DAG, HITL requests, agent context, and IPC packets).

---

## Phase 2: Runtime Foundation & OS Sandbox

**Objective**: Construct the core operating system layer, user home folder bootstrap, native keyring credential vault, model provider gateways, process isolation jails, and static AST security linters.

### 1. Daemon Workspace & Engine Bootstrap
- [x] Configure package manifest and dependencies in [packages/agent-runtime/package.json](../packages/agent-runtime/package.json).
- [x] Set up TypeScript build configuration in [packages/agent-runtime/tsconfig.json](../packages/agent-runtime/tsconfig.json) referencing `@krypton/shared-types`.
- [x] Implement system folder provisioner in [packages/agent-runtime/src/filesystem/bootstrap.ts](../packages/agent-runtime/src/filesystem/bootstrap.ts):
  - Resolve cross-platform home directory (`%USERPROFILE%\.krypton` on Windows, `$HOME/.krypton` on POSIX).
  - Provision required directory tree on first launch: `config.json`, `credentials.enc`, `cache/outputs/`, `pty_sessions/`, `telemetry/`, `agents/`, `worktrees/`, `tools/python/`, `tools/typescript/`, `browser_profiles/default/`, `logs/`.
  - Seed default orchestrator agent templates (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`).
- [x] Implement Markdown metadata parser and serializer in [packages/agent-runtime/src/filesystem/parser.ts](../packages/agent-runtime/src/filesystem/parser.ts) to parse YAML frontmatter and markdown sections.
- [x] Implement high-efficiency file watcher in [packages/agent-runtime/src/filesystem/watcher.ts](../packages/agent-runtime/src/filesystem/watcher.ts) with debounced reload hooks when agent configs are edited.

### 2. Native OS Secret Vault & Encryption
- [x] Implement OS Keyring bridge in [packages/agent-runtime/src/providers/vault.ts](../packages/agent-runtime/src/providers/vault.ts):
  - Integrate native OS credential storage (Windows Credential Manager, macOS Keychain, Linux Secret Service).
  - Implement AES-256-GCM fallback encryption for storing credentials into `~/.krypton/credentials.enc` using a machine-specific hardware derivative key when native keyring daemon is unavailable.
  - Provide secure async methods: `storeSecret(key, value)`, `getSecret(key)`, `deleteSecret(key)`, `hasSecret(key)`.

### 3. Model Provider Gateways
- [x] Implement OpenAI-compatible gateway in [packages/agent-runtime/src/providers/openai.ts](../packages/agent-runtime/src/providers/openai.ts):
  - Support OpenAI, DeepSeek, Groq, vLLM, and local Ollama / llama-server endpoints.
  - Implement streaming token handling, exponential backoff retries on rate limits (429), and standardized function calling formatting.
- [x] Implement Anthropic native gateway in [packages/agent-runtime/src/providers/anthropic.ts](../packages/agent-runtime/src/providers/anthropic.ts):
  - Map universal messages to Anthropic `/v1/messages` format, handling isolated system prompt strings and `input_schema` tool definitions.
  - Implement content block streaming (`text_delta`, `input_json_delta`) and handle tool call assembling.
- [x] Implement provider factory router in [packages/agent-runtime/src/providers/index.ts](../packages/agent-runtime/src/providers/index.ts) dispatching requests based on agent `IDENTITY.md` configuration.

### 4. Static AST Safety Linter (Failure Prevention: Shell Escapes & Destructive Code)
- [x] Implement TypeScript/JavaScript AST validator in [packages/agent-runtime/src/sandbox/linter.ts](../packages/agent-runtime/src/sandbox/linter.ts):
  - Parse code with Babel parser / TypeScript compiler API into an AST.
  - Scan for hazardous module imports and identifiers: `child_process`, `cluster`, `worker_threads`, `process.exit`, dangerous file system write calls on root drives (`rmSync('/')`, `unlinkSync('C:\\Windows')`).
  - Check for dynamic evaluation expressions: `eval()`, `new Function()`, `vm.runInThisContext()`.
- [x] Implement Python AST validator in [packages/agent-runtime/src/sandbox/linter.ts](../packages/agent-runtime/src/sandbox/linter.ts):
  - Run static inspection script against generated Python code.
  - Block calls: `os.system`, `subprocess.Popen`, `subprocess.run`, `shutil.rmtree('/')`, `pty.spawn`, socket network binds unless permitted.
- [x] Construct permission check escalation bridge: if a script contains flagged operations, trigger a `ClarificationRequest` asking the user to approve execution.

### 5. OS Subprocess Sandbox & Execution Jail
- [x] Implement process execution manager in [packages/agent-runtime/src/sandbox/runner.ts](../packages/agent-runtime/src/sandbox/runner.ts):
  - Windows: Wrap execution within a restricted Windows Job Object via native FFI or helper binary to impose memory caps (e.g. 512MB max), CPU limits, and prevent unauthorized child processes.
  - Linux/macOS: Enforce execution limits via `posix_spawn` / `rlimit` (RLIMIT_AS, RLIMIT_CPU, RLIMIT_NPROC) and unprivileged execution folders.
  - Assign an ephemeral workspace directory for every execution inside `~/.krypton/sandbox_workspace/<exec-id>`.
  - Enforce strict execution timeout caps (default 30s) using AbortSignals and forced process-tree kills (`tree-kill`).
  - Capture and sanitize stdout/stderr with memory limit caps to prevent buffer overflows.
- [x] Create execution starter templates in [packages/agent-runtime/src/sandbox/templates/python_runner.py](../packages/agent-runtime/src/sandbox/templates/python_runner.py) and [packages/agent-runtime/src/sandbox/templates/ts_runner.ts](../packages/agent-runtime/src/sandbox/templates/ts_runner.ts).

### 6. Context Window Optimization & Output Masking (Failure Prevention: Context Exhaustion)
- [x] Implement tool observation offloader in [packages/agent-runtime/src/context/offloader.ts](../packages/agent-runtime/src/context/offloader.ts):
  - Intercept tool results; if byte length or token count exceeds threshold (>1,500 tokens / ~6KB), persist the raw output into `~/.krypton/cache/outputs/run_step_<id>.log`.
  - Inject a masked summary into context containing the first 25 lines, total line count, byte size, file path on disk, and the last 25 lines.
- [x] Implement context compactor in [packages/agent-runtime/src/context/condenser.ts](../packages/agent-runtime/src/context/condenser.ts):
  - Calculate context window token utilization percentage before every LLM invocation.
  - When utilization exceeds 90%, trigger compaction: generate an LLM state summarization turn preserving core objective, active task DAG state, and file diff references, while discarding stale intermediate conversational tool loops.

### 7. Event Sourcing & Crash Recovery
- [x] Implement append-only event log writer in [packages/agent-runtime/src/event-sourcing/event-store.ts](../packages/agent-runtime/src/event-sourcing/event-store.ts):
  - Stream all system events directly to `~/.krypton/agents/<agent_name>/short_term/events.jsonl`.
  - Maintain atomic sync with sequence numbers and timestamps.
- [x] Implement state rehydration in [packages/agent-runtime/src/event-sourcing/recovery.ts](../packages/agent-runtime/src/event-sourcing/recovery.ts):
  - On runtime startup, scan `events.jsonl` files for incomplete tasks.
  - Rehydrate `AgentState`, reconnect to existing Git worktrees, and resume execution without starting over.

### 8. Mid-Flight Asynchronous Steering Queue
- [x] Implement dual-buffer event queue in [packages/agent-runtime/src/steering/dual-buffer-queue.ts](../packages/agent-runtime/src/steering/dual-buffer-queue.ts):
  - Buffer A: Primary execution sequence read by the agent loop.
  - Buffer B: High-priority steering interrupt queue receiving user inputs from Voice HUD, CLI, or UI.
  - Swap and evaluate between every tool execution step to support dynamic user course correction without crashing running sub-agents.

### Phase 2 Verification Gate
- [x] **Filesystem Bootstrap Test**: Run integration test verifying `~/.krypton` directory provisioning and default file scaffolding.
- [x] **AST Safety Linter Test Suite**: Execute test suite in `packages/agent-runtime/__tests__/linter.test.ts` verifying that malicious scripts (`rm -rf`, `os.system`, `child_process.exec`) are 100% blocked with specific AST rejection errors.
- [x] **Sandbox Isolation Test**: Execute a script exceeding memory and timeout bounds in `packages/agent-runtime/__tests__/sandbox.test.ts` to verify process tree termination.
- [x] **Context Offload & Compaction Test**: Verify large stdout payload is offloaded to disk and context is compacted when exceeding 90% mock threshold.
- [x] **Secret Vault Roundtrip Test**: Run mock keyring storage and retrieval test ensuring zero plaintext leaks.

---

## Phase 3: Recursive Actor-Model Engine, Task Planner & VCS

**Objective**: Build the heart of Krypton's autonomous problem-solving engine: the universal Actor agent class, hierarchical scheduling, dynamic Todo DAG planner, Git worktree isolation, autonomous semantic commits, and the Model Context Protocol (MCP) host.

### 1. Universal Actor Engine
- [x] Implement core `Agent` actor class in [packages/agent-runtime/src/actor/agent.ts](../packages/agent-runtime/src/actor/agent.ts):
  - Initialize instance with isolated `AgentContext`, unique UUID, system prompt from `IDENTITY.md`, behavioral rules from `SOUL.md`, and permissions from `AGENTS.md`.
  - Provide an autonomous step loop: Observe -> Plan/Reflect -> Tool Execution -> Verification.
  - Maintain private message context without leaking parent conversation history.
  - Implement sub-agent spawning method `spawnChild(role, taskDescription, budgetAllocation)`.
- [x] Implement actor lifecycle and memory synchronization in [packages/agent-runtime/src/actor/state.ts](../packages/agent-runtime/src/actor/state.ts):
  - Manage state transitions and emit state change events to the event bus.
  - Extract distilled insights on task completion and write to `~/.krypton/agents/<agent_name>/MEMORY.md`.

### 2. Actor Scheduler & Budget Governor (Failure Prevention: Infinite Recursion & Token Exhaustion)
- [x] Implement hierarchical scheduler in [packages/agent-runtime/src/actor/scheduler.ts](../packages/agent-runtime/src/actor/scheduler.ts):
  - Enforce hard recursion limit: reject `spawnChild` calls when `current_depth >= max_depth` (depth <= 3).
  - Enforce global concurrency limiter: allow a maximum of 5 active concurrent sub-agents across the runtime; queue surplus tasks.
  - Enforce token budget limits: subtract token usage from child budget; trigger graceful termination when budget is exhausted.
  - Parent-controlled timeout: bind each child execution to a parent `AbortController` (default 60s per child task).

### 3. Dynamic Task Planner DAG & Error Replanner
- [x] Implement hierarchical task tree in [packages/agent-runtime/src/planner/task-tree.ts](../packages/agent-runtime/src/planner/task-tree.ts):
  - Decompose high-level instructions into an ordered DAG with dependency validation.
  - Provide DAG manipulation methods: `addTask`, `completeTask`, `failTask`, `getNextExecutableTasks`.
  - Synchronize live state into human-readable Markdown format in `~/.krypton/agents/<agent_name>/TODO.md`.
- [x] Implement dynamic replanner in [packages/agent-runtime/src/planner/replanner.ts](../packages/agent-runtime/src/planner/replanner.ts):
  - Intercept step errors and task failures.
  - Pause downstream dependent tasks, evaluate failure diagnostics, and inject remediation tasks (e.g. `Task 2b: Fix compilation error in auth.ts`) into the DAG.
  - Emit plan restructuring events to all connected clients.

### 4. Git Worktree Version Control Engine (Krypton-VCS)
- [x] Implement worktree manager in [packages/agent-runtime/src/vcs/worktree.ts](../packages/agent-runtime/src/vcs/worktree.ts):
  - Inspect target repository, verify clean base state, and create isolated worktrees under `~/.krypton/worktrees/<task-id>`.
  - Create dedicated task branch `krypton/<task-id>` without dirtying the user's active branch or working directory.
  - Safely prune and remove worktrees on task completion or cancellation (`git worktree remove --force`).
- [x] Implement autonomous commit generator in [packages/agent-runtime/src/vcs/commit.ts](../packages/agent-runtime/src/vcs/commit.ts):
  - Stage changes after every completed atomic task step (`git add -A`).
  - Generate semantic Conventional Commit messages based on the task description and AST diff.
  - Commit changes and record the verified commit hash into the trajectory.
- [x] Implement diff and rollback engine in [packages/agent-runtime/src/vcs/diff.ts](../packages/agent-runtime/src/vcs/diff.ts):
  - Calculate unified diffs between the worktree branch and the base commit.
  - Provide deterministic rollback: if unit tests or linters fail, reset hard (`git reset --hard <last_verified_commit>`).
  - Provide merge gateway preparation: generate conflict-free patch sets ready for user review.

### 5. Trajectory Logging & Verification (Prime-Agent Pattern)
- [x] Implement trajectory recorder in [packages/agent-runtime/src/trajectory/recorder.ts](../packages/agent-runtime/src/trajectory/recorder.ts):
  - Record step-by-step frames `(action, observation, tool_call, delta)` into `~/.krypton/agents/<agent_name>/short_term/trajectories/<session-id>.json`.
  - Maintain an immutable audit log of all model reasoning and external interactions.
- [x] Implement pre-completion verification harness in [packages/agent-runtime/src/trajectory/verifier.ts](../packages/agent-runtime/src/trajectory/verifier.ts):
  - Run automated verification checks (linter, compiler typecheck, unit test execution, or browser screenshot assertion) before marking any task as `completed`.
  - If verification fails, flag the task as `failed` and trigger the dynamic replanner.

### 6. Human-in-the-Loop Clarification Bus
- [x] Implement multi-channel prompt dispatcher in [packages/agent-runtime/src/interaction/prompt-bus.ts](../packages/agent-runtime/src/interaction/prompt-bus.ts):
  - Dispatch `ClarificationRequest` packets across all active client transports (Desktop UI, CLI, Voice HUD, external channels).
  - Enforce timeout and cancelation tokens.
- [x] Implement async input resolver in [packages/agent-runtime/src/interaction/resolver.ts](../packages/agent-runtime/src/interaction/resolver.ts):
  - Block agent execution promise awaiting user answer.
  - First valid response unblocks the agent and cancels pending prompts on other channels.

### 7. Extensible Model Context Protocol (MCP) Host
- [x] Implement MCP Client Manager in [packages/agent-runtime/src/mcp/client.ts](../packages/agent-runtime/src/mcp/client.ts):
  - Support spawning local stdio MCP servers with automatic restart and health checks.
  - Support connecting to remote HTTP/SSE MCP endpoints.
  - Implement strict process isolation so MCP servers cannot inspect sibling servers.
- [x] Implement dynamic tool registry in [packages/agent-runtime/src/mcp/registry.ts](../packages/agent-runtime/src/mcp/registry.ts):
  - Discover tools via `tools/list` on all connected servers.
  - Convert tools into unified JSON schema definitions compatible with OpenAI and Anthropic formatters.
  - Namespace tools (e.g. `server_name__tool_name`) to prevent collisions.
  - Handle tool invocation routing and result formatting.

### Phase 3 Verification Gate
- [x] **Recursive Spawning & Limiter Test**: Execute test in `packages/agent-runtime/__tests__/actor_recursion.test.ts` to verify recursion is strictly halted at depth 3, max concurrency is capped at 5, and token budget exhaustion cleanly halts children.
- [x] **Task DAG Replanner Test**: Injected error test verifying that when a task fails, downstream tasks pause and a repair sub-task is dynamically inserted.
- [x] **VCS Worktree & Rollback Test**: Test creating a Git worktree, staging changes, committing semantic steps, and executing a hard rollback to the previous commit hash upon an injected failure.
- [x] **MCP Client Stdio Test**: Spawn a mock stdio MCP server, discover tools, execute a call, and verify result roundtrip.

---

## Phase 4: Perception & Interaction Engine

**Objective**: Build the sensory and environmental execution layer: stealth accessibility-tree browser automation, cubic Bézier mouse humanizer, persistent PTY terminal pool, Tree-sitter code intelligence, and OS-level accessibility automation.

### 1. Stealth Playwright & CDP Browser Engine (Failure Prevention: Browser Memory Leaks)
- [ ] Implement browser context pool in [packages/agent-runtime/src/browser/browser.ts](../packages/agent-runtime/src/browser/browser.ts):
  - Enforce a strict pool limit: maximum of 2 active browser contexts at any time.
  - Implement idle context recycler: terminate and clean up contexts idle for >15 minutes.
  - Store shared session cookies and local storage persistently in `~/.krypton/browser_profiles/default/`.
  - Connect to user browser via remote debugging port (CDP) or launch isolated Chromium instance.
- [ ] Implement anti-bot stealth evasions in [packages/agent-runtime/src/browser/browser.ts](../packages/agent-runtime/src/browser/browser.ts):
  - Override `navigator.webdriver` via CDP scripts.
  - Spoof WebGL vendor/renderer strings, audio context signatures, and plugins array.
  - Randomize viewport dimensions within realistic desktop display ranges.

### 2. Accessibility Tree (AXTree) Blind Navigation
- [ ] Implement accessibility tree extractor in [packages/agent-runtime/src/browser/axtree.ts](../packages/agent-runtime/src/browser/axtree.ts):
  - Query Chrome DevTools Protocol `Accessibility.getFullAXTree` directly.
  - Prune non-interactive structural elements (`<div>`, `<span>`) to reduce payload by up to 90%.
  - Assign sequential transient numeric IDs (`[id=1]`, `[id=2]`) to actionable nodes (buttons, inputs, links, dropdowns).
  - Generate a lightweight, semantic page snapshot with node IDs, roles, names, and bounding boxes.
- [ ] Implement high-level blind navigation actions in [packages/agent-runtime/src/browser/actions.ts](../packages/agent-runtime/src/browser/actions.ts):
  - Implement `click(id)`, `type(id, text)`, `select(id, value)`, `scroll(direction)`, `hover(id)`.
  - Add fallback to vision/CDP raw DOM snapshot if the accessibility node is obscured or missing.

### 3. Humanized Interaction & Agent Visual Cursor
- [ ] Implement mouse and keystroke humanizer in [packages/agent-runtime/src/browser/humanizer.ts](../packages/agent-runtime/src/browser/humanizer.ts):
  - Generate cubic Bézier movement trajectories with randomized control points and natural velocity profiles.
  - Introduce micro-overshoot and target correction jitter simulating real human motor control.
  - Simulate typing with Gaussian-distributed keypress delays (60ms–140ms per stroke) and realistic pause intervals.
- [ ] Implement visual cursor overlay injection in [packages/agent-runtime/src/browser/actions.ts](../packages/agent-runtime/src/browser/actions.ts):
  - Inject a visible, non-interfering DOM cursor overlay onto the page showing real-time agent mouse coordinates.
  - Render an agent badge at the bottom of the cursor displaying the active agent name (e.g. `[ScraperBot]`).

### 4. Persistent Interactive PTY Terminal Pool
- [ ] Implement pseudo-terminal manager in [packages/agent-runtime/src/terminal/pty-pool.ts](../packages/agent-runtime/src/terminal/pty-pool.ts):
  - Manage long-running process sessions using `node-pty`.
  - Persist terminal sockets and session outputs in `~/.krypton/pty_sessions/<session-id>.log`.
  - Support background execution of persistent servers (`npm run dev`, `docker compose up`) without blocking the agent loop.
  - Expose methods for interactive stdin injection (e.g., answering interactive CLI prompts, entering passwords).
- [ ] Implement ANSI/VT100 escape cleaner in [packages/agent-runtime/src/terminal/ansi-cleaner.ts](../packages/agent-runtime/src/terminal/ansi-cleaner.ts):
  - Strip control codes, color escapes, cursor positioning sequences to produce clean plain text for LLM observation ingestion.

### 5. Codebase Intelligence (Tree-sitter & LSP Client)
- [ ] Implement Tree-sitter AST parser in [packages/agent-runtime/src/intelligence/tree-sitter.ts](../packages/agent-runtime/src/intelligence/tree-sitter.ts):
  - Support language grammars: TypeScript, JavaScript, Python, Rust, Go.
  - Index code repositories, extracting function signatures, classes, exported interfaces, and import graphs with zero compilation cost.
- [ ] Implement headless LSP client in [packages/agent-runtime/src/intelligence/lsp-client.ts](../packages/agent-runtime/src/intelligence/lsp-client.ts):
  - Spawn language servers (`typescript-language-server`, `pyright`) over stdio.
  - Query compiler diagnostics, jump-to-definition, find-references, and type hover information to validate code edits before committing.

### 6. Native Desktop OS Automation
- [ ] Implement OS accessibility tree reader in [packages/agent-runtime/src/desktop-os/native-tree.ts](../packages/agent-runtime/src/desktop-os/native-tree.ts):
  - Windows: Query UI Automation (UIA) APIs to inspect native desktop controls and window elements.
  - macOS: Query AXUIElement accessibility tree for native macOS controls.
- [ ] Implement native window controller in [packages/agent-runtime/src/desktop-os/window-manager.ts](../packages/agent-runtime/src/desktop-os/window-manager.ts):
  - Support listing open application windows, bringing windows to foreground, minimizing, and positioning.

### Phase 4 Verification Gate
- [ ] **Browser Memory Leak & Pooling Test**: Run automated script launching 10 sequential browser sessions; verify that context count never exceeds 2, idle timer terminates contexts, and memory is recycled.
- [ ] **AXTree Extraction Benchmark**: Test AXTree extraction against a complex mock web page; verify interactive node labeling and 90% size reduction compared to raw DOM.
- [ ] **PTY Interactive Session Test**: Run interactive bash/powershell session via `node-pty`, send interactive input via stdin, and verify clean ANSI-stripped output in log.
- [ ] **Tree-sitter Symbol Indexing Test**: Execute Tree-sitter indexing on a sample TypeScript/Python repo and assert symbol map generation.

---

## Phase 5: Desktop App Shell & Micro-HUD

**Objective**: Construct the native Tauri v2 desktop application, the multi-window architecture, the floating voice HUD overlay, Parakeet v3 / Whisper audio bridge, global OS shortcuts, and the high-performance React dashboard.

### 1. Tauri v2 Rust Shell & Multi-Window Architecture
- [ ] Configure Tauri manifest and permissions in [apps/desktop/src-tauri/tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json):
  - Configure multi-window setup: `main` window (dashboard) and `overlay` window (voice HUD).
  - Configure overlay window properties: `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`.
  - Declare sidecar configuration for `binaries/krypton-daemon`.
  - Configure system permissions: global shortcut listener, system tray, audio capture, native window management.
- [ ] Set up Rust crate configuration in [apps/desktop/src-tauri/Cargo.toml](../apps/desktop/src-tauri/Cargo.toml) with Tauri v2 plugins.
- [ ] Implement Tauri app initialization in [apps/desktop/src-tauri/src/main.rs](../apps/desktop/src-tauri/src/main.rs):
  - Setup system tray icon with quick actions (Show Dashboard, Toggle Voice HUD, Stop Active Agents, Quit).
  - Initialize window controllers and IPC command handlers.
- [ ] Implement system path resolver in [apps/desktop/src-tauri/src/paths.rs](../apps/desktop/src-tauri/src/paths.rs) resolving `~/.krypton` and checking disk permissions.

### 2. Rust Sidecar Lifecycle & Daemon Supervision
- [ ] Implement sidecar supervisor in [apps/desktop/src-tauri/src/commands/sidecar.rs](../apps/desktop/src-tauri/src/commands/sidecar.rs):
  - Spawn `krypton-daemon` binary as a managed child process.
  - Monitor daemon stdout/stderr and expose health check ping over local IPC.
  - Ensure clean termination: kill daemon child process tree on app exit to prevent orphaned background processes.

### 3. Global Hotkeys & Transparent Floating Overlay Controller
- [ ] Implement global shortcut manager in [apps/desktop/src-tauri/src/commands/hotkey.rs](../apps/desktop/src-tauri/src/commands/hotkey.rs):
  - Register configurable system hotkey (default: `CommandOrControl+Shift+Space`).
  - Toggle the floating Voice Micro-HUD window visibility instantly.
- [ ] Implement overlay positioning and window behavior in [apps/desktop/src-tauri/src/overlay.rs](../apps/desktop/src-tauri/src/overlay.rs):
  - Center overlay dynamically above active display cursor position.
  - Manage focus stealing avoidance and click-through options when idle.

### 4. Audio Streaming & Speech-to-Text Bridge (Parakeet v3 / Whisper)
- [ ] Implement microphone capture stream in [apps/desktop/src-tauri/src/commands/audio.rs](../apps/desktop/src-tauri/src/commands/audio.rs):
  - Capture audio input stream via `cpal` with ring-buffer chunking.
  - Bind to local Whisper.cpp / Parakeet v3 engine for zero-latency local speech-to-text.
  - Provide fallback toggle to cloud transcription APIs (Groq/OpenAI Whisper) when local compute is constrained.
  - Stream transcribed text events directly into the frontend and daemon steering queue.

### 5. Desktop React Frontend: Dashboard Window
- [ ] Configure layout and styling in [apps/desktop/src/app/layout.tsx](../apps/desktop/src/app/layout.tsx) and [apps/desktop/src/app/globals.css](../apps/desktop/src/app/globals.css):
  - Setup dark-mode first aesthetic, glassmorphic panels, and refined typography.
- [ ] Build primary workspace dashboard in [apps/desktop/src/app/dashboard/page.tsx](../apps/desktop/src/app/dashboard/page.tsx):
  - Render agent fleet status, active sub-agent trees, live token spend, and current execution status.
  - Include mid-flight steering input bar to inject prompts during live executions.
- [ ] Build interactive Todo DAG component in [apps/desktop/src/components/TodoTree.tsx](../apps/desktop/src/components/TodoTree.tsx):
  - Render task dependency graph with visual status badges (`pending`, `in_progress`, `completed`, `failed`).
  - Animate dynamic plan restructuring and step insertions in real-time.
- [ ] Build HITL clarification modal in [apps/desktop/src/components/QuestionModal.tsx](../apps/desktop/src/components/QuestionModal.tsx):
  - Display questions with pill selectors, full keyboard navigation (numbers/arrows), and freeform response field.
- [ ] Build Git worktree visual diff viewer in [apps/desktop/src/components/VcsDiffViewer.tsx](../apps/desktop/src/components/VcsDiffViewer.tsx):
  - Display side-by-side syntax-highlighted diffs of agent modifications.
  - Provide user actions: "Approve & Merge to Working Branch", "Rollback Step", "Reject & Abort".

### 6. Desktop React Frontend: Floating Voice Micro-HUD
- [ ] Build floating voice HUD interface in [apps/desktop/src/app/overlay/page.tsx](../apps/desktop/src/app/overlay/page.tsx):
  - Render compact, translucent, borderless Spotlight-style bar.
  - Include real-time audio waveform visualizer responding to mic input.
  - Include Target Agent Selector chip (`[Orchestrator]`, `[Coder]`, `[Scraper]`).
  - Display streaming live transcription preview and quick status pill.

### 7. Frontend State Management & Communication Hooks
- [ ] Implement Tauri IPC and WebSocket state hooks in [apps/desktop/src/hooks/useKryptonDaemon.ts](../apps/desktop/src/hooks/useKryptonDaemon.ts):
  - Establish persistent WebSocket / IPC connection to `krypton-daemon`.
  - Synchronize task trees, log streams, and HITL prompt requests.
- [ ] Implement voice transcription hook in [apps/desktop/src/hooks/useVoiceHud.ts](../apps/desktop/src/hooks/useVoiceHud.ts):
  - Manage push-to-talk audio recording, streaming transcription, and prompt dispatch to target agent.

### Phase 5 Verification Gate
- [ ] **Rust Backend Build & Check**: Run `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` verifying zero Rust compilation errors.
- [ ] **Desktop Frontend Build**: Run `pnpm --filter desktop build` verifying Next.js production compilation.
- [ ] **Multi-Window & IPC Smoke Test**: Launch app in test mode; verify both `main` and `overlay` windows initialize, global shortcut toggles overlay, and IPC echo command returns successful ping.

---

## Phase 6: Omni-Channel Gateway & Native Distribution

**Objective**: Complete the external messaging bridge (Telegram, Discord, WhatsApp, Slack, Signal), develop the native Ink terminal CLI (`krypton-cli`), automate single-binary daemon compilation, and configure cross-platform distribution installers.

### 1. Multi-Platform Channel Adapters
- [ ] Implement channel session router in [packages/agent-runtime/src/channels/router.ts](../packages/agent-runtime/src/channels/router.ts):
  - Maintain persistent routing table mapping channel threads and user IDs to specific agents.
  - Normalize incoming payloads (text, images, voice notes, documents) into universal message formats.
  - Normalize outgoing markdown to platform-compatible syntax (Telegram HTML, WhatsApp markdown, Discord markdown).
- [ ] Implement Telegram adapter in [packages/agent-runtime/src/channels/telegram.ts](../packages/agent-runtime/src/channels/telegram.ts):
  - Integrate grammY bot framework; support commands, thread-locking, and inline keyboard buttons for HITL clarification requests.
- [ ] Implement Discord adapter in [packages/agent-runtime/src/channels/discord.ts](../packages/agent-runtime/src/channels/discord.ts):
  - Integrate Discord.js; handle guild channels, thread creation per task, and action row button components for HITL prompts.
- [ ] Implement WhatsApp adapter in [packages/agent-runtime/src/channels/whatsapp.ts](../packages/agent-runtime/src/channels/whatsapp.ts):
  - Integrate Baileys socket connection; store session credentials in `~/.krypton/browser_profiles/whatsapp/`.
  - Format HITL choices as numbered reply menus for mobile interaction.
- [ ] Implement Slack adapter in [packages/agent-runtime/src/channels/slack.ts](../packages/agent-runtime/src/channels/slack.ts):
  - Integrate `@slack/bolt`; render task DAG updates and interactive Block Kit modals for user prompts.
- [ ] Implement Signal adapter in [packages/agent-runtime/src/channels/signal.ts](../packages/agent-runtime/src/channels/signal.ts):
  - Wrap `signal-cli` JSON-RPC over stdio for end-to-end encrypted autonomous interaction.

### 2. Standalone Terminal CLI Engine (`krypton-cli`)
- [ ] Set up package configuration in [packages/cli/package.json](../packages/cli/package.json) and [packages/cli/tsconfig.json](../packages/cli/tsconfig.json).
- [ ] Implement IPC client in [packages/cli/src/ipc-client.ts](../packages/cli/src/ipc-client.ts):
  - Connect to running `krypton-daemon` via platform pipe (Windows Named Pipe or POSIX Domain Socket).
  - Auto-spawn daemon in headless mode if not currently active.
- [ ] Implement interactive terminal UI using React + Ink:
  - Build live task progress view in [packages/cli/src/ui/TaskListView.tsx](../packages/cli/src/ui/TaskListView.tsx) showing interactive spinners and task DAG states.
  - Build interactive question prompter in [packages/cli/src/ui/QuestionPrompt.tsx](../packages/cli/src/ui/QuestionPrompt.tsx) with arrow-key navigation and custom text entry.
- [ ] Implement CLI command router in [packages/cli/src/index.ts](../packages/cli/src/index.ts):
  - `krypton run "<instruction>"`: Dispatch instruction to orchestrator agent.
  - `krypton vcs [diff|rollback|merge]`: Review or approve pending Git worktree changes.
  - `krypton agents [list|create|edit]`: Manage agent personas and configurations.
  - `krypton tools [list|test]`: Inspect active MCP and synthesized tools.
- [ ] Implement system PATH installer in [apps/desktop/src-tauri/src/commands/installer.rs](../apps/desktop/src-tauri/src/commands/installer.rs):
  - Automatically symlink or add `krypton` CLI binary into system PATH during first desktop app launch.

### 3. Standalone Binary Compilation & Sidecar Bundling
- [ ] Implement daemon single-binary compiler script in [scripts/build-sidecar.mjs](../scripts/build-sidecar.mjs):
  - Compile `packages/agent-runtime` into a standalone native binary using Bun (`bun build --compile`) or `@vercel/pkg`.
  - Output target-specific sidecar binaries into `apps/desktop/src-tauri/binaries/`:
    - `krypton-daemon-x86_64-pc-windows-msvc.exe`
    - `krypton-daemon-x86_64-apple-darwin`
    - `krypton-daemon-aarch64-apple-darwin`
    - `krypton-daemon-x86_64-unknown-linux-gnu`
- [ ] Implement CLI single-binary compiler script in [scripts/build-cli.mjs](../scripts/build-cli.mjs):
  - Compile `packages/cli` into a standalone executable (`krypton` / `krypton.exe`).
- [ ] Implement runtime environment setup script in [scripts/setup-env.mjs](../scripts/setup-env.mjs):
  - Verify Playwright browser driver availability, audio dependencies, and Git version.

### 4. Cross-Platform Native Packaging & CI Release Pipeline
- [ ] Configure GitHub Actions cross-compilation pipeline in [.github/workflows/release.yml](../.github/workflows/release.yml):
  - Matrix builds across: Windows (`windows-latest`), macOS Intel (`macos-13`), macOS Apple Silicon (`macos-14`), and Linux (`ubuntu-22.04`).
  - Automated steps: Compile sidecar binary, build Next.js frontend assets, invoke `tauri build` to package final native bundles.
  - Generate platform artifacts:
    - Windows: `.msi` and NSIS `.exe` installer.
    - macOS: Notarized `.dmg` / `.app` bundle.
    - Linux: `.AppImage` and `.deb` packages.
- [ ] Implement first-boot browser binary downloader in [packages/agent-runtime/src/filesystem/bootstrap.ts](../packages/agent-runtime/src/filesystem/bootstrap.ts):
  - Ensure installer stays under 100MB by pulling Chromium binaries on-demand into `~/.krypton/browser_binaries` with desktop UI progress feedback.

### Phase 6 Verification Gate
- [ ] **CLI Standalone Binary Test**: Execute `scripts/build-cli.mjs`; run `./krypton --help` to verify CLI executes independently without external Node/Bun runtime installed.
- [ ] **Sidecar Binary Compilation Test**: Execute `scripts/build-sidecar.mjs`; test starting the compiled daemon binary and pinging its IPC socket.
- [ ] **Channel Mock Dispatch Integration Test**: Run test suite in `packages/agent-runtime/__tests__/channels.test.ts` verifying incoming mock messages from Telegram/Discord trigger agent processing and return normalized responses.
- [ ] **End-to-End System Packaging Test**: Execute `pnpm run build` across all workspace packages followed by `tauri build --debug` to verify complete desktop bundling.

---

## Critical Failure Mode Defense Matrix

| Failure Mode | Root Cause | Implemented Defense Mechanism | Location in Codebase |
| :--- | :--- | :--- | :--- |
| **Infinite Recursion / Death Spiral** | Sub-agent B errors, spawns Sub-agent C indefinitely; exhausts tokens & RAM. | 1. Hard recursion ceiling (`max_depth <= 3`).<br>2. Global concurrent sub-agent cap (max 5 active).<br>3. Hard token budget inheritance with auto-kill on budget zero.<br>4. Parent-controlled 60s timeout abort controllers. | [packages/agent-runtime/src/actor/scheduler.ts](../packages/agent-runtime/src/actor/scheduler.ts)<br>[packages/shared-types/src/agent.ts](../packages/shared-types/src/agent.ts) |
| **Malicious / Destructive Code Execution** | Agent writes scripts with `rm -rf /`, `del /s /q C:`, fork bombs, or opens backdoors. | 1. Static AST linter blocks dangerous modules and identifiers (`child_process`, `os.system`, `eval`).<br>2. Windows Job Objects / POSIX rlimit caps CPU/RAM.<br>3. Ephemeral sandboxes in `~/.krypton/sandbox_workspace/`.<br>4. Mandatory HITL confirmation dialog for flagged actions. | [packages/agent-runtime/src/sandbox/linter.ts](../packages/agent-runtime/src/sandbox/linter.ts)<br>[packages/agent-runtime/src/sandbox/runner.ts](../packages/agent-runtime/src/sandbox/runner.ts) |
| **Browser Instance Memory Leaks** | Continuous iterative web scraping creates orphan Chromium instances, exhausting system RAM. | 1. Centralized Browser Context Pool enforcing maximum of 2 active contexts.<br>2. Idle context recycler kills instances inactive for >15 minutes.<br>3. Persistent browser profiles prevent session leak.<br>4. Context teardown hooks on agent completion. | [packages/agent-runtime/src/browser/browser.ts](../packages/agent-runtime/src/browser/browser.ts) |
| **Context Window Exhaustion** | Huge tool responses (logs, HTML, compile errors) flood LLM prompt context. | 1. Output offloader intercepts outputs >1,500 tokens, dumps raw logs to disk (`~/.krypton/cache/outputs/`), and replaces context with head/tail summary.<br>2. Context compactor condenses history at 90% utilization into distilled state checkpoint. | [packages/agent-runtime/src/context/offloader.ts](../packages/agent-runtime/src/context/offloader.ts)<br>[packages/agent-runtime/src/context/condenser.ts](../packages/agent-runtime/src/context/condenser.ts) |
| **Host Codebase Contamination / Data Loss** | Flawed agent edits corrupt working branches or overwrite uncommitted user code. | 1. All coding tasks run inside isolated Git worktrees under `~/.krypton/worktrees/<task-id>`.<br>2. Pre-completion test/lint validation harness.<br>3. Hard rollback to verified commit hash on step error.<br>4. Merge to user branch gated by visual diff approval. | [packages/agent-runtime/src/vcs/worktree.ts](../packages/agent-runtime/src/vcs/worktree.ts)<br>[packages/agent-runtime/src/vcs/diff.ts](../packages/agent-runtime/src/vcs/diff.ts)<br>[packages/agent-runtime/src/trajectory/verifier.ts](../packages/agent-runtime/src/trajectory/verifier.ts) |
| **Process Crash & State Amnesia** | App crash, system reboot, or power cut destroys in-flight task progress. | 1. Append-only event store (`events.jsonl`) records all state mutations.<br>2. Startup rehydration engine replays event log and reconnects to existing Git worktrees without repeating completed work. | [packages/agent-runtime/src/event-sourcing/event-store.ts](../packages/agent-runtime/src/event-sourcing/event-store.ts)<br>[packages/agent-runtime/src/event-sourcing/recovery.ts](../packages/agent-runtime/src/event-sourcing/recovery.ts) |

---

## Master Progress Tracker

- [ ] **Phase 1: Shared Core & Type Contracts** (0% Completed)
- [ ] **Phase 2: Runtime Foundation & OS Sandbox** (0% Completed)
- [ ] **Phase 3: Recursive Actor-Model Engine, Task Planner & VCS** (0% Completed)
- [ ] **Phase 4: Perception & Interaction Engine** (0% Completed)
- [ ] **Phase 5: Desktop App Shell & Micro-HUD** (0% Completed)
- [ ] **Phase 6: Omni-Channel Gateway & Native Distribution** (0% Completed)
