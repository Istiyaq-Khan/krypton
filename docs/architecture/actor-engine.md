# Recursive Actor Engine & Execution Loop

This document details the Actor-Model agent execution architecture, recursion boundaries, concurrency controls, token budgeting, and event-sourced state persistence in **Krypton**.

---

## 1. Universal Actor Model Architecture

Every agent instance in Krypton is modeled as a universal `Agent` actor (`packages/agent-runtime/src/actor/agent.ts`):
- **Isolated Context**: Maintains a private message history, unique UUID, system prompt instructions, and tool whitelist.
- **Stateless Tool Invocations**: Communicates with external environments strictly through structured tool interfaces and the Model Context Protocol (MCP).
- **Hierarchical Delegation**: Any agent can spawn specialized sub-agents (`spawnChild()`) to distribute sub-tasks, subject to strict recursion ceilings.

### Core Autonomous Step Loop

```
  ┌──────────────────────────────────────────────────────────┐
  │ 1. OBSERVE: Receive user prompt or child step result     │
  └─────────────────────────────┬────────────────────────────┘
                                │
                                ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 2. REASON / PLAN: Evaluate task DAG & synthesize steps   │
  └─────────────────────────────┬────────────────────────────┘
                                │
                                ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 3. VALIDATE: Run AST safety linter on generated actions  │
  └─────────────────────────────┬────────────────────────────┘
                                │
                                ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 4. EXECUTE: Isolated Git worktree / OS sandbox execution │
  └─────────────────────────────┬────────────────────────────┘
                                │
                                ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 5. VERIFY: Automated testing & compilation assertions    │
  └─────────────────────────────┬────────────────────────────┘
                                │ (Pass: Stage semantic commit / Fail: Rollback & Replan)
                                ▼
  ┌──────────────────────────────────────────────────────────┐
  │ 6. CHECKPOINT: Append event to events.jsonl ledger       │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. Recursion Ceilings & Concurrency Defense

To prevent infinite loops and runaway compute consumption, the Hierarchical Scheduler (`packages/agent-runtime/src/actor/scheduler.ts`) enforces strict limits:

| Parameter | Default Cap | Enforcement Behavior |
| :--- | :--- | :--- |
| `max_depth` | `3` | When `current_depth >= 3`, any call to `spawnChild()` is rejected immediately with `RecursionDepthExceededError`. |
| Global Concurrency | `5` sub-agents | At most 5 concurrent sub-agent processes may execute simultaneously; additional tasks are queued. |
| Execution Timeout | `60s` per task | Each sub-agent task is bounded by an `AbortController`. On timeout, child processes are terminated. |
| Token Budget Share | `50%` of remaining | Parent delegates a finite token allocation to each child. If exhausted, child halts cleanly. |

---

## 3. Crash Recovery & Event Sourcing

Krypton uses an append-only event-sourcing ledger to guarantee state durability across system restarts or unexpected crashes:

### Storage Structure (`~/.krypton/agents/<name>/short_term/`)
- `events.jsonl`: Discrete serialized events conforming to `KryptonSystemEvent` (`AgentSpawned`, `PlanUpdated`, `ToolExecuting`, `ToolFinished`, `StateCheckpointed`).
- `trajectories/<sessionId>.json`: Frame-by-frame audit logs of actions, observations, tool invocations, and git diff summaries.

### Rehydration Protocol (`recovery.ts`)
1. On daemon startup, the recovery engine scans `~/.krypton/agents/*/short_term/events.jsonl`.
2. Reconstructs in-memory `AgentState` and active `TaskTree` DAG.
3. Inspects `~/.krypton/worktrees/` to re-attach to active task worktrees without losing uncommitted progress.
4. Resumes execution from the last verified checkpoint.
