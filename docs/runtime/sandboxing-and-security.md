# Dynamic Code Sandboxing & AST Security Linter

This document specifies the static Abstract Syntax Tree (AST) safety inspection, OS-level subprocess isolation jails, and execution safety boundaries in **Krypton**.

---

## 1. Static AST Safety Linter (`linter.ts`)

Before any synthesized TypeScript, JavaScript, or Python code is executed on the host system, it must pass through Krypton's static AST safety linter:

```
[Agent Synthesizes Script]
           │
           ▼
[AST Parser (Babel / Python AST)]
           │
           ├─► Does AST contain forbidden imports, dangerous calls, or root writes?
           │        │
           │        ├─► YES: Block execution immediately!
           │        │        Emit AST violation report & trigger replanner or HITL prompt.
           │        │
           │        └─► NO: Mark script as verified safe.
           ▼
[Dispatch to OS-Constrained Subprocess Jail]
```

### Banned Identifiers & Modules

| Category | Prohibited Patterns | Reason |
| :--- | :--- | :--- |
| **System Command Spawning** | `child_process.exec`, `child_process.spawn`, `os.system`, `subprocess.Popen` | Prevents unverified shell command escapes |
| **Destructive Filesystem Writes** | `rm -rf /`, `del /s /q`, `rmSync('/')`, `shutil.rmtree('/')`, root drive writes | Prevents host filesystem corruption |
| **Dynamic Code Evaluation** | `eval()`, `new Function()`, `vm.runInThisContext()`, `exec()` | Prevents arbitrary untracked bytecode execution |
| **Process Destruction** | `process.exit()`, `sys.exit()` | Prevents sub-agents from aborting the host daemon |

If an operation requires shell execution (e.g. running build tools or tests), it must route through dedicated, monitored runner abstractions rather than raw scripts.

---

## 2. OS Subprocess Sandbox & Resource Jails (`runner.ts`)

Scripts that pass AST inspection are launched inside constrained operating system subprocesses:

### Platform-Specific Jail Mechanisms:
- **Windows**: Wrapped inside **Windows Job Objects** via native bindings:
  - Memory limit: Capped at 512MB RAM.
  - CPU priority: Throttled to prevent host freezing.
  - Process tree kill: Guaranteed recursive child process cleanup on exit.
- **macOS & Linux**: Enforced via `posix_spawn` and `rlimit`:
  - `RLIMIT_AS`: Address space / virtual memory caps.
  - `RLIMIT_CPU`: CPU time execution limits.
  - `RLIMIT_NPROC`: Restricts spawning fork bombs.

### Ephemeral Execution Workspaces
Every sandboxed execution runs inside an isolated, temporary directory:
```
~/.krypton/sandbox_workspace/<exec-id>/
```
On completion or timeout (default 30 seconds), the ephemeral directory is purged, leaving zero dangling artifacts.
