import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { McpClientManager, StdioMcpClient } from "../src/mcp/client.js";
import { ToolRegistry } from "../src/mcp/registry.js";

describe("Model Context Protocol (MCP) Host & Dynamic Tool Registry", () => {
  let tempDir: string;
  let mockServerScript: string;
  let manager: McpClientManager;
  let registry: ToolRegistry;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-mcp-test-"));
    mockServerScript = path.join(tempDir, "mock_mcp_server.mjs");

    // Create a mock stdio MCP server implementing JSON-RPC 2.0
    const serverCode = `
import * as readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line.trim());
    if (msg.method === "initialize") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: { protocolVersion: "2024-11-05", capabilities: { tools: {} } }
      }) + "\\n");
    } else if (msg.method === "tools/list") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          tools: [
            {
              name: "calculate_sum",
              description: "Calculates the sum of two integers",
              inputSchema: {
                type: "object",
                properties: {
                  a: { type: "number", description: "First number" },
                  b: { type: "number", description: "Second number" }
                },
                required: ["a", "b"]
              }
            }
          ]
        }
      }) + "\\n");
    } else if (msg.method === "tools/call") {
      const { name, arguments: args } = msg.params;
      if (name === "calculate_sum") {
        const sum = (args.a ?? 0) + (args.b ?? 0);
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [{ type: "text", text: String(sum) }],
            isError: false
          }
        }) + "\\n");
      } else {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32601, message: "Method not found" }
        }) + "\\n");
      }
    } else if (msg.method === "ping") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: {}
      }) + "\\n");
    }
  } catch (e) {
    // Ignore malformed input
  }
});
`;
    fs.writeFileSync(mockServerScript, serverCode, "utf-8");

    manager = new McpClientManager();
    registry = new ToolRegistry(manager);
  });

  afterEach(async () => {
    await manager.disconnectAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("spawns mock stdio MCP server, initializes handshake, and discovers tools", async () => {
    const client = await manager.registerServer({
      name: "calculator_server",
      enabled: true,
      transport: {
        type: "stdio",
        command: process.execPath,
        args: [mockServerScript],
        env: {},
      },
    });

    expect(client.isConnected).toBe(true);

    // Ping check
    const pingOk = await client.ping();
    expect(pingOk).toBe(true);

    // Discover tools in registry
    const discovered = await registry.discoverTools();
    expect(discovered).toHaveLength(1);
    expect(discovered[0].name).toBe("calculate_sum");

    // Verify namespacing
    const toolEntry = registry.getTool("calculator_server__calculate_sum");
    expect(toolEntry).toBeDefined();
    expect(toolEntry?.serverName).toBe("calculator_server");
    expect(toolEntry?.originalName).toBe("calculate_sum");
  });

  it("formats tools for OpenAI and Anthropic specifications", async () => {
    await manager.registerServer({
      name: "math_service",
      enabled: true,
      transport: {
        type: "stdio",
        command: process.execPath,
        args: [mockServerScript],
        env: {},
      },
    });

    await registry.discoverTools();

    // OpenAI format
    const openAIFuncs = registry.toOpenAIFunctions();
    expect(openAIFuncs).toHaveLength(1);
    expect(openAIFuncs[0].type).toBe("function");
    expect(openAIFuncs[0].function.name).toBe("math_service__calculate_sum");
    expect(openAIFuncs[0].function.description).toContain("Calculates the sum");

    // Anthropic format
    const anthropicTools = registry.toAnthropicTools();
    expect(anthropicTools).toHaveLength(1);
    expect(anthropicTools[0].name).toBe("math_service__calculate_sum");
    expect(anthropicTools[0].input_schema).toBeDefined();
  });

  it("routes tool execution request to MCP client and returns standardized execution result", async () => {
    await manager.registerServer({
      name: "calc",
      enabled: true,
      transport: {
        type: "stdio",
        command: process.execPath,
        args: [mockServerScript],
        env: {},
      },
    });

    await registry.discoverTools();

    const agentId = "99999999-9999-9999-9999-999999999999";
    const execResult = await registry.invokeTool({
      requestId: crypto.randomUUID(),
      agentId,
      toolName: "calc__calculate_sum",
      parameters: { a: 17, b: 25 },
      timeoutMs: 5000,
      sandbox: true,
    });

    expect(execResult.isError).toBe(false);
    expect(execResult.exitCode).toBe(0);
    expect(execResult.stdout).toBe("42");
    expect(execResult.durationMs).toBeGreaterThanOrEqual(0);
  });
});
