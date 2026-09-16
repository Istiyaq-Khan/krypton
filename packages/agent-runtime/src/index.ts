/**
 * Krypton Autonomous Agent Runtime Engine.
 */

// Filesystem bootstrap, archetype loader & configurations
export * from "./filesystem/bootstrap.js";
export * from "./filesystem/template-loader.js";
export * from "./filesystem/parser.js";
export * from "./filesystem/watcher.js";

// Providers & Keyring secret vault
export * from "./providers/index.js";

// AST safety linter & sandbox execution runner
export * from "./sandbox/linter.js";
export * from "./sandbox/runner.js";

// Context window optimization & output offloading
export * from "./context/offloader.js";
export * from "./context/condenser.js";

// Event sourcing & crash recovery
export * from "./event-sourcing/event-store.js";
export * from "./event-sourcing/recovery.js";

// Mid-flight steering queue
export * from "./steering/dual-buffer-queue.js";

// Phase 3: Recursive Actor Engine & Scheduler
export * from "./actor/state.js";
export * from "./actor/scheduler.js";
export * from "./actor/agent.js";

// Phase 3: Dynamic Task Planner DAG & Replanner
export * from "./planner/task-tree.js";
export * from "./planner/replanner.js";

// Phase 3: Git Worktree Version Control Engine (Krypton-VCS)
export * from "./vcs/worktree.js";
export * from "./vcs/commit.js";
export * from "./vcs/diff.js";

// Phase 3: Trajectory Logging & Verification (Prime-Agent Pattern)
export * from "./trajectory/recorder.js";
export * from "./trajectory/verifier.js";

// Phase 3: Human-in-the-Loop Clarification Bus
export * from "./interaction/prompt-bus.js";
export * from "./interaction/resolver.js";

// Phase 3: Model Context Protocol (MCP) Host
export * from "./mcp/client.js";
export * from "./mcp/registry.js";

// Phase 4: Perception & Interaction Engine
// Browser Automation & AXTree
export * from "./browser/browser.js";
export * from "./browser/axtree.js";
export * from "./browser/humanizer.js";
export * from "./browser/actions.js";

// Persistent Interactive PTY Terminal Pool
export * from "./terminal/ansi-cleaner.js";
export * from "./terminal/pty-pool.js";

// Codebase Intelligence (Tree-sitter & LSP)
export * from "./intelligence/tree-sitter.js";
export * from "./intelligence/lsp-client.js";

// Native Desktop OS Automation
export * from "./desktop-os/native-tree.js";
export * from "./desktop-os/window-manager.js";

// Phase 6: Omni-Channel Gateway
export * from "./channels/index.js";
