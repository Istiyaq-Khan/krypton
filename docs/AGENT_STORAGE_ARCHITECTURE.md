# Krypton Agent Storage Architecture: Structured `config.json` & Pure Context Markdown

This document specifies the storage layout, persistence mechanics, separation of concerns, and migration protocols for autonomous agent workspaces in the Krypton runtime (`~/.krypton/agents/<agentName>/`).

---

## 1. Architectural Philosophy: Separation of Concerns

Krypton strictly separates **machine-readable operational configuration** from **human- and LLM-readable prompt/context documents**:

```
~/.krypton/agents/<agentName>/
├── config.json                # Dedicated machine configuration (JSON, strictly typed)
├── IDENTITY.md                # Persona, creature, vibe, and system prompt text (pure markdown)
├── SOUL.md                    # Core directives, reasoning style & behavioral guardrails
├── AGENTS.md                  # Operational workspace conventions & local notes
├── USER.md                    # Durable user directives & profile facts
├── MEMORY.md                  # Curated long-term distilled knowledge & facts
├── TODO.md                    # Live task DAG ledger & permanent historical task log
├── BOOTSTRAP.md               # First-run onboarding ritual (cleared upon initialization)
└── short_term/                # Append-only transcripts, event store & trajectories
    ├── events.jsonl
    └── trajectories/
```

### Invariant Rules
1. **`config.json` Is Single Source of Machine Truth**: Model identifiers, temperature, provider routing, token budgets, recursion boundaries (`maxDepth`), and tool manifests are persisted exclusively in `config.json`.
2. **Markdown Files Contain Zero Configuration Keys**: Markdown files (`*.md`) are reserved strictly for instructions, personality, user models, domain knowledge, and execution ledgers. Markdown frontmatter MUST NOT serialize application settings or configuration keys.
3. **Prompt Assembler Isolation**: Context loading pipelines assemble system prompts from markdown files as pure text, stripping any documentation fences, preventing machine configuration keys from leaking into LLM generation contexts.
4. **Independent Mutation**: Modifying settings in `config.json` does not rewrite or touch markdown files; updating markdown prompt files does not alter `config.json`.

---

## 2. Machine Configuration Specification (`config.json`)

Each agent folder contains a strictly validated `config.json` conforming to `AgentConfigFileSchema` in `@krypton/shared-types`:

```json
{
  "id": "agent-orchestrator",
  "name": "Orchestrator",
  "role": "System Orchestrator & Autonomous Desktop Agent",
  "model": "claude-3-7-sonnet-20250219",
  "provider": "anthropic",
  "temperature": 0.2,
  "contextWindowLimit": 128000,
  "tools": [
    "terminal",
    "filesystem",
    "astLinter",
    "web"
  ],
  "permissions": {
    "allowedSubAgents": [
      "CoderBot",
      "TesterBot"
    ],
    "allowedTools": [
      "terminal",
      "filesystem",
      "astLinter",
      "web"
    ],
    "maxDepth": 3,
    "maxConcurrentChildren": 5,
    "budgetShare": 0.5,
    "canSynthesizeTools": true,
    "canAccessNetwork": true,
    "canModifyWorkspace": true,
    "terminal": true,
    "filesystem": true,
    "web": true,
    "astLinter": true
  },
  "budget": {
    "total": 100000,
    "used": 0
  },
  "createdAt": 1773826000000,
  "updatedAt": 1773826000000,
  "metadata": {}
}
```

### Key Schema Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (e.g., UUID or normalized agent slug). |
| `name` | `string` | Human-readable name of the agent instance. |
| `role` | `string` | High-level role definition (e.g. "Full-Stack Actor"). |
| `model` | `string` | Primary LLM model identifier (e.g., `claude-3-7-sonnet-20250219`, `deepseek-r1`). |
| `provider` | `string` | Active provider (`anthropic`, `openai`, `ollama`, `custom`). |
| `temperature` | `number` | Sampling temperature between `0.0` and `2.0`. |
| `tools` | `string[]` | Active tool whitelist available to this agent instance. |
| `permissions` | `object` | Sub-agent recursion caps (`maxDepth`), concurrency limits, and capability flags. |
| `budget` | `object` | Hard token limit (`total`) and accumulated token consumption (`used`). |
| `createdAt` / `updatedAt` | `number` | Unix epoch millisecond timestamps. |

---

## 3. Pure Context Markdown Files (`*.md`)

Markdown files in the workspace serve strictly as context for reasoning and task execution:

| File | Purpose | Pure Content Structure |
|---|---|---|
| `IDENTITY.md` | Who the agent is | Explains persona, creature, vibe, avatar reference, and operational charter. |
| `SOUL.md` | How the agent thinks | Core truths, reasoning guidelines, safety boundaries, and tone guardrails. |
| `AGENTS.md` | Workspace conventions | Operating procedures, memory guidelines, group chat etiquette, local notes. |
| `USER.md` | User model | Durable directives with observation dates (`Always`, `Never`, `Prefer`). |
| `MEMORY.md` | Long-term memory | Distilled non-profile facts, verified architectural decisions, lessons learned. |
| `TODO.md` | Task ledger | Dynamic task tree DAG (active checklist) and append-only historical audit log. |
| `BOOTSTRAP.md` | Onboarding ritual | First-run onboarding ritual (agent-governed lifecycle; deleted via file tools once verified). |

---

## 4. Runtime Synchronization & Self-Healing

The agent runtime storage service (`packages/agent-runtime/src/filesystem/agent-storage.ts` and `workspace-storage.ts`) manages disk operations:

### 1. Graceful Migration & Self-Healing
If an older or uninitialized workspace directory lacks `config.json`:
1. `readAgentConfig` inspects legacy files (`IDENTITY.md`, `AGENTS.md`) for legacy YAML frontmatter.
2. Extracts legacy model/role/temperature/permissions if found.
3. Automatically synthesizes a fully compliant `config.json` with safe defaults.
4. Atomically writes `config.json` to disk, completing migration with zero manual intervention.

### 2. Prompt Assembler & Bootstrap Injection
When instantiating an agent via `Agent.fromWorkspace(agentName)` or `loadAgentContext(agentName)`:
1. `config.json` is parsed into typed runtime parameters (boundary limits, model options, tool executor bindings).
2. `readAgentContextMarkdown()` reads `IDENTITY.md`, `SOUL.md`, `AGENTS.md`, and `USER.md` with frontmatter-stripping enabled.
3. If `BOOTSTRAP.md` or `bootstrap.md` exists in the agent workspace or project workspace, the birth sequence is automatically ingested into the system prompt with explicit `CRITICAL ONBOARDING DIRECTIVE` rules.
4. **Zero System Deletion Invariant**: The Krypton daemon and runtime NEVER automatically delete `BOOTSTRAP.md`.
5. **Agent Governance**: The agent alone is responsible for executing onboarding beats and deleting `BOOTSTRAP.md` via file tools (`file_delete`, `delete_file`) once verified.

### 3. IPC / Daemon RPC Methods
The background daemon exposes dedicated JSON-RPC 2.0 endpoints:
- `listAgents`: Returns all agents with configurations deserialized directly from `config.json`.
- `createAgent`: Provisions workspace with `config.json` and pure markdown context.
- `getAgent`: Returns both structured `config.json` and pure markdown prompt contents.
- `updateAgent`: Modifies `config.json` without altering markdown context files.
- `updateAgentContext`: Updates a specific `*.md` file without modifying `config.json`.
- `workspace:save` / `saveWorkspace`: Atomically saves workspace records to `~/.krypton/workspaces/<id>.json`.
- `workspace:load` / `loadWorkspace`: Retrieves saved workspace definition from disk.
- `workspace:list` / `listWorkspaces`: Lists all registered workspaces sorted by last access.
- `workspace:delete` / `deleteWorkspace`: Removes workspace definition from disk.
- `session:save` / `saveSession`: Atomically persists chat session threads to `~/.krypton/sessions/<id>.json`.
- `session:load` / `loadSession`: Loads full session thread with complete message history.
- `session:list` / `listSessions`: Lists stored session threads (optionally filtered by workspace).
- `session:delete` / `deleteSession`: Removes session thread from disk.
- `workstation:saveState` / `loadWorkstationState`: Persists and retrieves workstation layout state.
- `agent:deleteBootstrap` / `deleteBootstrap`: Executes agent-governed deletion of `BOOTSTRAP.md`.
