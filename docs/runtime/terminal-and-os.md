# Terminal Pool, Tree-sitter & Desktop OS Automation

This document covers the persistent interactive pseudo-terminal (PTY) pool, Tree-sitter code intelligence, headless LSP integration, and native desktop OS accessibility automation in **Krypton**.

---

## 1. Persistent Interactive PTY Terminal Pool (`pty-pool.ts`)

For long-running tasks (e.g. running local dev servers, test watchers, or interactive CLI setups), standard stateless subprocesses are insufficient. Krypton manages persistent pseudo-terminals:

- **Library**: Powered by `node-pty` across Windows (ConPTY) and POSIX (pty).
- **Session Persistence**: Sessions are saved and logged to `~/.krypton/pty_sessions/<session-id>.log`.
- **Interactive Stdin Injection**: Allows agents to answer interactive prompts (e.g. `[y/N]`, password entries, or menu arrows) without terminating the process.
- **ANSI Escape Cleaner (`ansi-cleaner.ts`)**: Strips terminal control codes, color escapes, and cursor repositioning characters to feed clean, token-efficient plain text to the LLM.

---

## 2. Codebase Intelligence: Tree-sitter & LSP

Rather than blindly parsing raw source files, Krypton incorporates structured code intelligence:

### Tree-sitter AST Indexing (`tree-sitter.ts`)
- Supported languages: TypeScript, JavaScript, Python, Rust, Go.
- **Fast Syntax Graph**: Extracts function signatures, exported classes, interfaces, and cross-file import graphs with zero compiler overhead.
- Enables agents to query symbol references before modifying code.

### Headless LSP Client (`lsp-client.ts`)
- Spawns language servers (e.g. `typescript-language-server`, `pyright`) over stdio.
- Provides jump-to-definition, find-references, and pre-commit compiler diagnostics to catch type mismatches before staging commits.

---

## 3. Native Desktop OS Automation (`desktop-os/`)

When tasked with interacting directly with native desktop software outside the browser:

- **Windows UI Automation (UIA)**: Inspects native desktop windows, menu bars, buttons, and text fields via `native-tree.ts`.
- **macOS AXUIElement**: Traverses the macOS accessibility hierarchy.
- **Window Manager (`window-manager.ts`)**: Supports listing open OS application windows, bringing windows to focus, minimizing, or snapping window bounds.
