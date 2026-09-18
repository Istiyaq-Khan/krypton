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
│ - Windows: \\.\pipe\krypton-ipc│ - Host: 127.0.0.1:18789     │
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
| `listAgents` | `{}` | `AgentSummary[]` | Returns all available agent configurations |
| `createAgent` | `{ name, role, model, provider, temperature, permissions, systemPrompt }` | `{ agentName, agentDir, config, success }` | Provisions new agent workspace |
| `getAgent` | `{ name }` | `{ config, prompts, combinedSystemPrompt }` | Reads `config.json` and pure markdown prompts |
| `updateAgent` | `{ name, patch }` | `{ agentName, config, success }` | Modifies machine-readable `config.json` |
| `updateAgentContext`| `{ name, fileName, content }` | `{ agentName, fileName, success }` | Modifies pure markdown prompt (`*.md`) |
| `startTask` | `{ prompt, agentName }` | `{ taskId, status, initialDag }` | Initiates autonomous execution DAG |
| `controlProcess` | `{ agentId, action }` | `{ success, agentId, action, status }` | Aborts, pauses, or resumes active tasks |
| `resolveApproval`| `{ approvalId, approved }` | `{ resolved: true, approvalId, approved }` | Resolves pending human action approval |
| `resolveClarification`| `{ requestId, selectedOptionIds, freeformText }` | `{ resolved: true, requestId }` | Resolves multi-choice HITL prompt |
| `getVcsDiff` | `{ worktreeId }` | `DiffSummary` (`files, additions, deletions`) | Returns unified Git worktree diff |
| `mergeVcs` | `{ worktreeId }` | `{ success: true, commitHash }` | Merges worktree changes into parent branch |

---

## 4. WebSocket Streaming Event Types

Connected clients receive live events pushed by `broadcast(packet)`:

- `token_stream`: LLM token delta chunks (`{ delta, index, isComplete }`).
- `agent_log`: Formatted logging entries (`{ level: 'info' | 'warn' | 'error', message }`).
- `task_tree_updated`: Real-time serialized DAG node updates (`{ serializedTasks }`).
- `clarification_requested`: Dispatched when an agent requires user disambiguation.
