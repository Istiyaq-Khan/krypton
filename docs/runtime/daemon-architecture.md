# Background Daemon Architecture & JSON-RPC Dispatcher

This document details the background daemon engine (`krypton-daemon`), transport adapters, RFC 6455 WebSocket streaming, and JSON-RPC 2.0 API methods in **Krypton**.

---

## 1. Daemon Overview (`daemon.ts`)

The background daemon is the headless core of the Krypton runtime:
- Compiled into a single standalone binary for each OS using Bun or `@vercel/pkg`.
- Runs as a persistent background service managed by the Tauri desktop supervisor or launched independently by the CLI.
- Hosts the actor scheduler, task DAG planner, Git worktree engine, AST sandbox, and MCP host.

---

## 2. Multi-Transport Wire Architecture

The daemon simultaneously listens across two local communication protocols:

```
┌─────────────────────────────────────────────────────────────┐
│                    KryptonDaemonServer                      │
├──────────────────────────────┬──────────────────────────────┤
│ 1. Platform Local Pipe       │ 2. RFC 6455 WebSocket       │
│ - Windows: \\.\pipe\krypton-ipc│ - Host: 127.0.0.1:19840     │
│ - Unix: /tmp/krypton.sock    │ - Real-time full-duplex      │
│ - Low-latency IPC for CLI    │ - Token streaming & logs     │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 3. JSON-RPC 2.0 API Registry

The daemon implements standard JSON-RPC 2.0 message dispatching (`handleRpcCall`):

| Method | Parameters | Return Payload | Purpose |
| :--- | :--- | :--- | :--- |
| `ping` | `{}` | `{ pong: true, uptime, activeTasks, connectedClients }` | Health check & diagnostics |
| `getSystemMetrics` | `{}` | `{ memoryUsageMb, memoryRssMb, activeSubAgents, uptime }` | Memory and resource telemetry |
| `agents:list` / `listAgents` | `{}` | `AgentSummary[]` | Returns all live agent workspaces under `~/.krypton/agents/` |
| `agents:create` / `createAgent` | `{ name, model, provider, temperature, permissions, systemPrompt }` | `{ agentName, agentDir, config, success }` | Provisions new agent workspace with `config.json` and template `IDENTITY.md` |
| `agents:update` / `updateAgent` | `{ name, patch }` | `{ agentName, config, success }` | Modifies machine-readable `config.json` strictly on disk |
| `agents:delete` / `deleteAgent` | `{ name }` | `{ agentName, success }` | Safely unlinks agent workspace directory from disk |
| `getAgent` | `{ name }` | `{ config, prompts, combinedSystemPrompt }` | Reads `config.json` and pure markdown prompts |
| `updateAgentContext`| `{ name, fileName, content }` | `{ agentName, fileName, success }` | Modifies pure markdown prompt (`*.md`) |
| `startTask` | `{ prompt, agentName, model, provider, workspacePath, conversationHistory, askForApproval }` | `{ taskId, status, initialDag }` | Initiates autonomous execution DAG |
| `controlProcess` | `{ agentId, action }` | `{ success, agentId, action, status }` | Aborts, pauses, or resumes active tasks |
| `resolveApproval`| `{ approvalId, approved }` | `{ resolved: true, approvalId, approved }` | Resolves pending human action approval |
| `resolveClarification`| `{ requestId, selectedOptionIds, freeformText }` | `{ resolved: true, requestId }` | Resolves multi-choice HITL prompt |
| `getVcsDiff` | `{ worktreeId }` | `DiffSummary` (`files, additions, deletions`) | Returns unified Git worktree diff |
| `mergeVcs` | `{ worktreeId }` | `{ success: true, commitHash }` | Merges worktree changes into parent branch |

---

## 4. WebSocket Streaming Event Types

Connected clients receive live events pushed by `broadcast(packet)`:

- `token_stream`: LLM token delta chunks (`{ delta, index, isComplete, taskId, agentId }`).
- `agent_log`: Formatted logging entries (`{ level: 'info' | 'warn' | 'error', message, context }`).
- `task_tree_updated`: Real-time serialized DAG node updates (`{ treeId, agentId, serializedTasks }`).
- `clarification_requested`: Dispatched when an agent requires user disambiguation (`{ request }`).
- `tool_approval_requested`: High-priority event pausing runtime execution for sensitive tools (`{ approval }`).
- `tool_execution`: Emitted when an action executes (`{ taskId, agentId, tool: { id, type, title, status, stdout } }`).

---

## 5. Live IPC Streaming Pipeline

```
Renderer (UI)                               Daemon (Runtime)
     │                                             │
     │── startTask (prompt, model, wsPath, ...) ──>│
     │                                             │── Parse DAG & init TaskTree
     │<── task_tree_updated ───────────────────────│
     │                                             │── Run LLM / dynamic reasoning
     │<── token_stream (deltas) ───────────────────│
     │                                             │
     │       [Tool requires human approval]        │
     │<── tool_approval_requested (approvalId) ────│── Pause runtime Promise
     │                                             │
     │── resolveApproval (approvalId, approved) ──>│── Unblock Promise
     │                                             │
     │<── tool_execution (stdout, status) ─────────│── Execute / log tool
     │<── token_stream (isComplete: true) ─────────│
     │<── agent_log ("Task complete") ─────────────│
     │                                             │
```
