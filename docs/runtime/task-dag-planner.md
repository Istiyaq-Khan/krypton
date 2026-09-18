# Dynamic Task Planner DAG & Error Replanner

This document describes the hierarchical TaskTree Directed Acyclic Graph (DAG), topological scheduling, dynamic failure replanning, and markdown ledger synchronization in **Krypton**.

---

## 1. TaskTree Directed Acyclic Graph (`task-tree.ts`)

Krypton decomposes high-level user goals into structured, ordered sub-tasks modeled as a directed acyclic graph:

```
                  ┌──────────────────────────────┐
                  │ Task 1: Inspect Target Repo  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Task 2: Synthesize Plan      │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
  ┌─────────────────────────────┐ ┌─────────────────────────────┐
  │ Task 3a: Implement Backend  │ │ Task 3b: Implement Frontend │
  └──────────────┬──────────────┘ └──────────────┬──────────────┘
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ Task 4: Run Verification     │
                  └──────────────────────────────┘
```

### TaskNode Data Model
Each node in the graph implements `TaskNode` (`packages/shared-types/src/tasks.ts`):
- `id`: Unique UUID.
- `title`: Concise human-readable action description.
- `description`: Detailed operational parameters.
- `assignedAgentId`: Target agent or sub-agent identifier.
- `dependsOn`: Array of parent task UUIDs that must complete before this task unblocks.
- `status`: State enum (`pending`, `in_progress`, `completed`, `failed`, `blocked`).

---

## 2. Dynamic Error Replanner (`replanner.ts`)

When an execution step encounters a compilation failure, linter rejection, or broken test:
1. **Failure Interception**: The active task is marked as `failed`.
2. **Downstream Freezing**: All downstream dependent tasks (`dependsOn: [failedTaskId]`) are immediately transitioned to `blocked`.
3. **Diagnostic Analysis**: The replanner reads the error stack trace, AST violation, or test diff.
4. **Plan Patch Injection**: The replanner generates a dynamic `PlanPatch`:
   - Inserts a remediation task (e.g. `Task 2b: Fix syntax error in auth.ts`).
   - Updates downstream dependencies to wait for the remediation task.
5. **Client Broadcast**: Emits a `task_tree_updated` event to the desktop dashboard and CLI TUI, animating the restructured graph in real time.

---

## 3. Human-Readable Ledger Sync (`TODO.md`)

In addition to in-memory graph operations, the task engine synchronizes its state to `~/.krypton/agents/<agentName>/TODO.md`:
- Active tasks render as interactive GitHub-flavored markdown checklists (`- [x]`, `- [ ]`, `- [/]`).
- Completed task histories append permanently to the bottom historical log, providing an audit trail for developers inspecting the workspace directly from their terminal or text editor.
