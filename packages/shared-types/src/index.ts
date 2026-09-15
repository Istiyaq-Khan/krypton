/**
 * Centralized export for @krypton/shared-types.
 * Single source of truth for interfaces, Zod validation schemas, IPC protocols, and event contracts.
 */

// Agent & Context Contracts
export * from "./agent.js";

// Task DAG & Planner Contracts
export * from "./tasks.js";

// MCP & Tool Specification Contracts
export * from "./mcp.js";

// Version Control & Worktree Contracts
export * from "./vcs.js";

// Human-in-the-Loop Interaction Contracts
export * from "./interaction.js";

// IPC, RPC & WebSocket Wire Protocols
export * from "./ipc.js";

// Event-Sourcing & Trajectory Contracts
export * from "./events.js";

// Filesystem & Configuration Schemas
export * from "./config.js";
