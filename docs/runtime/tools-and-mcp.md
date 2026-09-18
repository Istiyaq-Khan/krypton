# Tools & Model Context Protocol (MCP) Host

This document specifies the Model Context Protocol (MCP) host architecture, tool registration, standard execution interfaces, and dynamic tool synthesis in **Krypton**.

---

## 1. MCP Host Architecture (`mcp/client.ts`)

Krypton acts as a full Model Context Protocol (MCP) client host capable of connecting to external tool servers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Krypton MCP Host Core                    │
├──────────────────────────────┬──────────────────────────────┤
│ Stdio Transport Client       │ SSE Transport Client         │
│ Spawns local CLI subprocess  │ Connects over HTTP / SSE     │
│ with process isolation      │ to remote tool microservices │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               └──────────────┬───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dynamic Tool Registry                    │
│ Namespaces tools (server__tool), transforms to JSON-Schema, │
│ and formats parameter definitions for OpenAI & Anthropic    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Dynamic Tool Registry (`mcp/registry.ts`)

The registry queries connected MCP servers via standard `tools/list` discovery and normalizes definitions into universal JSON-Schema contracts (`packages/shared-types/src/mcp.ts`):

- **Collision Prevention**: Tools from servers are namespaced (e.g. `github__create_issue`, `postgres__query_table`).
- **Permission Checking**: Matches tool invocations against the agent's `tools` whitelist in `config.json`.
- **Execution Lifecycle**:
  ```typescript
  const result = await registry.executeTool({
    serverName: "filesystem",
    toolName: "read_file",
    arguments: { path: "package.json" },
    callingAgentId: "agent-coder",
  });
  ```

---

## 3. Standard Built-in Tool Specifications

Every agent can be configured with built-in runtime tools:

| Tool Name | Capability | Safety Safeguard |
| :--- | :--- | :--- |
| `terminal` | Executes command-line scripts via persistent PTY pool | Output offloaded to disk if >1,500 tokens |
| `filesystem`| Reads and writes files within the current workspace | Blocked from writing to OS root drives |
| `astLinter` | Inspects code for safety violations | Rejects dangerous modules and shell escapes |
| `web` | Stealth browser automation & AXTree navigation | Capped at 2 active contexts; 15m idle cleanup |

---

## 4. Dynamic Tool Synthesis

When an agent encounters a problem lacking an existing tool, it can synthesize a custom script in Python or TypeScript:
1. Agent writes script code to `~/.krypton/tools/<lang>/<tool-name>`.
2. Static AST Linter evaluates code safety.
3. Code executes in an ephemeral test sandbox.
4. If output matches expectations, tool is tagged as reusable and registered dynamically in the agent's tool catalog.
