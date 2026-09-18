# Version Control & Git Worktrees (Krypton-VCS)

This document details the Git worktree isolation architecture, atomic semantic commit generation, deterministic rollback mechanics, and the visual merge gateway in **Krypton**.

---

## 1. Isolated Git Worktrees (`vcs/worktree.ts`)

To prevent autonomous coding sub-agents from dirtying the user's active branch or modifying uncommitted files, Krypton executes all autonomous code modifications inside isolated Git worktrees:

```
User's Primary Repository (~/my-project)
                  │
                  ▼ git worktree add
~/.krypton/worktrees/<task-id>/
   ├── Branch: krypton/<task-id>
   ├── Full working copy of repo at base commit
   └── Completely isolated from user's open editor / branch
```

### Invariant VCS Directives:
- **No Direct Branch Pollution**: Sub-agents never touch or commit directly to the active working branch.
- **Dedicated Task Branch**: Each task operates on `krypton/<task-id>`.
- **Automatic Pruning**: Upon task completion, rejection, or abortion, the worktree is cleanly removed via `git worktree remove --force`.

---

## 2. Atomic Conventional Semantic Commits (`vcs/commit.ts`)

After every successful sub-task execution step:
1. Changes are staged atomically (`git add -A`).
2. An AST diff is evaluated against the task objective.
3. A Conventional Commit message is generated automatically:
   - `feat(agent): implement auth token parsing`
   - `fix(vcs): resolve merge conflict in task tree`
   - `refactor(runtime): extract sandbox execution helper`
4. The commit hash is recorded into the session trajectory (`trajectories/<session-id>.json`).

---

## 3. Deterministic Hard Rollback (`vcs/diff.ts`)

If a verification step (linter, compiler typecheck, or unit test suite) fails after a code modification:
1. The agent halts progression.
2. The runtime invokes an immediate hard reset:
   ```bash
   git reset --hard <last_verified_commit_hash>
   git clean -fd
   ```
3. Restores the worktree to the exact state of the last passing commit.
4. Alerts the dynamic replanner to synthesize an alternate solution approach.

---

## 4. Visual Merge Approval Gateway

Autonomous code modifications are never merged back into the user's active branch without explicit human consent:

```
[Agent Completes All Worktree Tasks & Passes All Tests]
                          │
                          ▼
[Generate Unified Diff Summary (getVcsDiff)]
                          │
                          ▼
[Present VcsDiffViewer in Desktop UI or CLI]
                          │
             User audits side-by-side diff
                          │
             ┌────────────┴────────────┐
             │                         │
      [Approve & Merge]        [Reject & Abort]
             │                         │
             ▼                         ▼
   Fast-forward merge into      Prune worktree &
   user's active branch        delete task branch
```
