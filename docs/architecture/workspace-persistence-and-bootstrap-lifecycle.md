# Workspace Persistence & Agent-Governed Bootstrap Lifecycle

This document specifies the crash-resilient filesystem persistence architecture for workspaces, chat sessions, and workstation states, as well as the agent-governed lifecycle for `BOOTSTRAP.md` in the Krypton Autonomous Agent Operating System.

---

## 1. Architectural Principles

1. **Persistent Local Grounding**: Krypton workspaces, project records, chat histories, and global workstation layout state are backed by atomic, durable JSON files on the local filesystem rather than transient browser storage.
2. **Zero System Deletion Invariant**: The Krypton runtime and background daemon **NEVER** automatically delete, purge, or unlink `BOOTSTRAP.md` or `bootstrap.md` upon agent startup, workspace initialization, or configuration updates.
3. **Agent-Governed Lifecycle**: The autonomous agent alone is responsible for executing onboarding beats (birth sequence) and explicitly deleting `BOOTSTRAP.md` via file tools (`file_delete`, `delete_file`) once all setup tasks and verifications succeed.
4. **Cross-Platform Casing Parity**: Storage handlers and context assemblers resolve both `BOOTSTRAP.md` and `bootstrap.md` equivalently across case-sensitive (Linux) and case-insensitive (Windows, macOS) filesystems.
5. **No Resurrection**: Once deleted by the agent, subsequent daemon reboots or workspace bootstrap routines never resurrect or recreate `BOOTSTRAP.md` in an already-configured agent workspace.

---

## 2. Directory Layout & Persistence Schemas

All runtime data is managed under the resolved Krypton home directory (`~/.krypton/` or platform equivalent):

```
~/.krypton/
├── workspaces/
│   ├── <workspace-id>.json          # Individual workspace record (WorkspaceRecord)
│   └── ...
├── sessions/
│   ├── <session-id>.json            # Full chat session thread & message history (SessionThreadRecord)
│   └── ...
├── workstation-state.json           # Global workstation layout, tabs, & recent projects
└── agents/
    └── <agent-name>/
        ├── config.json              # Dedicated machine configuration
        ├── BOOTSTRAP.md             # First-run onboarding ritual (pending agent completion)
        ├── IDENTITY.md              # Pure markdown persona & creature identity
        ├── SOUL.md                  # Behavioral directives & reasoning guardrails
        ├── AGENTS.md                # Workspace conventions & rules
        ├── USER.md                  # User model & durable preferences
        ├── MEMORY.md                # Long-term knowledge base
        └── TODO.md                  # Task DAG ledger & historical audit log
```

### Crash-Resilient Atomic Writes
All workspace and session JSON mutations leverage the `atomicWriteJson` protocol:
1. Serialize data to a temporary staging file: `<targetFilePath>.tmp.<timestamp>.<nonce>`.
2. Flush and close the file descriptor.
3. Perform an atomic filesystem rename (`fs.promises.rename`) onto `<targetFilePath>`.
4. Guarantees that concurrent readers never observe partial, corrupted, or truncated JSON files.

---

## 3. The Agent-Governed BOOTSTRAP.md Lifecycle

### Step 1: Initial Workspace Provisioning
During the initial creation of an agent (`bootstrapAgentWorkspace(name)`), Krypton provisions `BOOTSTRAP.md` from the standard archetype template. The file contains the birth sequence (asking what to call you, choosing vibe/emoji, generating 2×2 avatar sheet, recommendations, safety note).

### Step 2: System Prompt Ingestion
When an agent is loaded via `loadAgentContext(agentName)` or `Agent.fromWorkspace(agentDir)`:
1. The loader checks for `BOOTSTRAP.md` or `bootstrap.md`.
2. If present, the content is parsed and injected directly into `combinedSystemPrompt` wrapped with high-priority directives:
   ```markdown
   =================================================================
   CRITICAL ONBOARDING DIRECTIVE: ACTIVE BOOTSTRAP PROTOCOL DETECTED
   =================================================================
   A pending initialization file exists in the active workspace.
   FILE CONTENT:
   ...
   OPERATIONAL RULES FOR BOOTSTRAP:
   1. You MUST execute, configure, or initialize any setup tasks listed in this file.
   2. Krypton will NEVER automatically delete this file.
   3. You alone are responsible for removing this file using file deletion tools once setup and verification are complete.
   =================================================================
   ```

### Step 3: Agent Task Execution & Self-Deletion
1. The agent interacts with the user to establish name, vibe, emoji, and avatar.
2. Once the onboarding beats are verified, the agent calls its built-in tool (`file_delete` / `delete_file` with target `BOOTSTRAP.md`).
3. The runtime deletes the file from disk via `deleteBootstrapFile()`.
4. The in-memory agent immediately clears its `bootstrapDirectives`, transitioning to standard operational status.

### Step 4: Subsequent Boot Without Resurrection
During subsequent reboots or calls to `bootstrapAgentWorkspace()`, the runtime recognizes that the agent directory already exists and is configured. It skips recreating `BOOTSTRAP.md`, ensuring the birth sequence never runs twice.

---

## 4. Daemon JSON-RPC 2.0 Dispatcher Endpoints

The background daemon exposes standardized RPC methods for frontend and CLI interaction:

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `workspace:save` | `WorkspaceRecord` | Atomically commits a workspace definition to disk. |
| `workspace:load` | `{ id: string }` | Loads workspace configuration from disk. |
| `workspace:list` | none | Lists all saved workspaces sorted by access time. |
| `workspace:delete` | `{ id: string }` | Removes a workspace record from disk. |
| `session:save` | `SessionThreadRecord` | Persists a session thread and full message history. |
| `session:load` | `{ id: string }` | Loads session thread and historical message records. |
| `session:list` | `{ workspaceId?: string }` | Lists all stored sessions (optionally filtered). |
| `session:delete` | `{ id: string }` | Removes a session record from disk. |
| `workstation:saveState` | `PersistedWorkstationState` | Persists workstation UI, sidebar, and tab states. |
| `workstation:loadState` | none | Loads workstation layout state from disk. |
| `agent:deleteBootstrap` | `{ target: string }` | Removes `BOOTSTRAP.md` via agent governance. |

---

## 5. Verification & Testing

The entire persistence and lifecycle protocol is covered by automated integration tests in:
- `packages/agent-runtime/__tests__/bootstrap_lifecycle.test.ts`
- `packages/agent-runtime/__tests__/agent_storage.test.ts`
- `packages/agent-runtime/__tests__/bootstrap.test.ts`
