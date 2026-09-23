import {
  AnthropicTool,
  AnthropicToolSchema,
  McpTool,
  OpenAIFunctionTool,
  OpenAIFunctionToolSchema,
  SynthesizedToolMetadata,
  SynthesizedToolMetadataSchema,
  ToolExecutionRequest,
  ToolExecutionRequestSchema,
  ToolExecutionResult,
  ToolExecutionResultSchema,
} from "@krypton/shared-types";
import { McpClientManager } from "./client.js";

export interface RegisteredToolEntry {
  namespacedName: string;
  originalName: string;
  serverName: string;
  tool: McpTool;
}

/**
 * Dynamic Tool Registry (MCP Host).
 * Discovers tools across all active MCP servers, generates unified OpenAI & Anthropic schemas,
 * namespaces tool identifiers (server__tool) to prevent name collisions, and routes execution requests.
 */
export class ToolRegistry {
  private readonly clientManager: McpClientManager;
  private tools = new Map<string, RegisteredToolEntry>();
  private synthesizedTools = new Map<string, SynthesizedToolMetadata>();
  private builtinExecutors = new Map<
    string,
    (params: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>
  >();

  constructor(clientManager: McpClientManager) {
    this.clientManager = clientManager;
  }

  /**
   * Registers a built-in system tool directly into the registry.
   */
  public registerBuiltinTool(
    tool: McpTool,
    executor: (params: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>
  ): void {
    const entry: RegisteredToolEntry = {
      namespacedName: `system__${tool.name}`,
      originalName: tool.name,
      serverName: "system",
      tool,
    };
    this.tools.set(entry.namespacedName, entry);
    if (!this.tools.has(tool.name)) {
      this.tools.set(tool.name, entry);
    }
    this.builtinExecutors.set(tool.name, executor);
    this.builtinExecutors.set(entry.namespacedName, executor);
  }

  /**
   * Refreshes and discovers all tools from connected MCP clients.
   */
  public async discoverTools(): Promise<McpTool[]> {
    // Preserve built-in tools when clearing
    const preservedBuiltin = new Map<string, RegisteredToolEntry>();
    for (const [key, val] of this.tools.entries()) {
      if (val.serverName === "system") {
        preservedBuiltin.set(key, val);
      }
    }

    this.tools.clear();
    for (const [key, val] of preservedBuiltin.entries()) {
      this.tools.set(key, val);
    }

    const discovered: McpTool[] = [];

    const clients = this.clientManager.listClients();
    for (const client of clients) {
      if (!client.isConnected) continue;

      try {
        const clientTools = await client.listTools();
        for (const tool of clientTools) {
          const namespacedName = `${client.serverName}__${tool.name}`;
          const entry: RegisteredToolEntry = {
            namespacedName,
            originalName: tool.name,
            serverName: client.serverName,
            tool,
          };

          this.tools.set(namespacedName, entry);

          // If no collision with original name, also register simple alias
          if (!this.tools.has(tool.name)) {
            this.tools.set(tool.name, entry);
          }

          discovered.push(tool);
        }
      } catch (err) {
        // Skip failed client tool discovery gracefully
      }
    }

    return discovered;
  }

  public getTool(name: string): RegisteredToolEntry | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): McpTool[] {
    const unique = new Map<string, McpTool>();
    for (const entry of this.tools.values()) {
      unique.set(entry.namespacedName, entry.tool);
    }
    return Array.from(unique.values());
  }

  /**
   * Formats tools for OpenAI / Ollama function calling specifications.
   */
  public toOpenAIFunctions(): OpenAIFunctionTool[] {
    const result: OpenAIFunctionTool[] = [];
    const seen = new Set<string>();

    for (const entry of this.tools.values()) {
      if (seen.has(entry.namespacedName)) continue;
      seen.add(entry.namespacedName);

      const fnTool: OpenAIFunctionTool = OpenAIFunctionToolSchema.parse({
        type: "function",
        function: {
          name: entry.namespacedName,
          description: entry.tool.description,
          parameters: entry.tool.inputSchema as unknown as Record<string, unknown>,
        },
      });
      result.push(fnTool);
    }

    return result;
  }

  /**
   * Formats tools for Anthropic native /v1/messages specifications.
   */
  public toAnthropicTools(): AnthropicTool[] {
    const result: AnthropicTool[] = [];
    const seen = new Set<string>();

    for (const entry of this.tools.values()) {
      if (seen.has(entry.namespacedName)) continue;
      seen.add(entry.namespacedName);

      const anthropicTool: AnthropicTool = AnthropicToolSchema.parse({
        name: entry.namespacedName,
        description: entry.tool.description,
        input_schema: entry.tool.inputSchema as unknown as Record<string, unknown>,
      });
      result.push(anthropicTool);
    }

    return result;
  }

  /**
   * Dispatches and routes a tool execution request to the appropriate MCP client.
   */
  public async invokeTool(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const validatedReq = ToolExecutionRequestSchema.parse(request);
    const startTime = Date.now();

    const entry = this.tools.get(validatedReq.toolName);
    if (!entry) {
      return ToolExecutionResultSchema.parse({
        requestId: validatedReq.requestId,
        toolName: validatedReq.toolName,
        stdout: "",
        stderr: `Tool '${validatedReq.toolName}' is not registered in MCP registry`,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        isError: true,
        outputOffloaded: false,
      });
    }

    const builtinExecutor = this.builtinExecutors.get(validatedReq.toolName);
    if (builtinExecutor) {
      try {
        const res = await builtinExecutor(validatedReq.parameters);
        const durationMs = Date.now() - startTime;
        return ToolExecutionResultSchema.parse({
          requestId: validatedReq.requestId,
          toolName: validatedReq.toolName,
          stdout: res.isError ? "" : res.content,
          stderr: res.isError ? res.content : "",
          exitCode: res.isError ? 1 : 0,
          durationMs,
          isError: Boolean(res.isError),
          outputOffloaded: false,
        });
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        return ToolExecutionResultSchema.parse({
          requestId: validatedReq.requestId,
          toolName: validatedReq.toolName,
          stdout: "",
          stderr: err?.message || String(err),
          exitCode: 1,
          durationMs,
          isError: true,
          outputOffloaded: false,
        });
      }
    }

    const client = this.clientManager.getClient(entry.serverName);
    if (!client || !client.isConnected) {
      return ToolExecutionResultSchema.parse({
        requestId: validatedReq.requestId,
        toolName: validatedReq.toolName,
        stdout: "",
        stderr: `MCP server '${entry.serverName}' is not currently connected`,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        isError: true,
        outputOffloaded: false,
      });
    }

    try {
      const callRes = await client.callTool(
        entry.originalName,
        validatedReq.parameters,
        validatedReq.timeoutMs
      );

      const durationMs = Date.now() - startTime;
      return ToolExecutionResultSchema.parse({
        requestId: validatedReq.requestId,
        toolName: validatedReq.toolName,
        stdout: callRes.isError ? "" : callRes.content,
        stderr: callRes.isError ? callRes.content : "",
        exitCode: callRes.isError ? 1 : 0,
        durationMs,
        isError: callRes.isError,
        outputOffloaded: false,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return ToolExecutionResultSchema.parse({
        requestId: validatedReq.requestId,
        toolName: validatedReq.toolName,
        stdout: "",
        stderr: err?.message || String(err),
        exitCode: 1,
        durationMs,
        isError: true,
        outputOffloaded: false,
      });
    }
  }

  // --- Synthesized Tools Management ---

  public registerSynthesizedTool(
    metadata: SynthesizedToolMetadata
  ): SynthesizedToolMetadata {
    const validated = SynthesizedToolMetadataSchema.parse(metadata);
    this.synthesizedTools.set(validated.name, validated);
    return validated;
  }

  public getSynthesizedTool(name: string): SynthesizedToolMetadata | undefined {
    return this.synthesizedTools.get(name);
  }

  public listSynthesizedTools(): SynthesizedToolMetadata[] {
    return Array.from(this.synthesizedTools.values());
  }
}
