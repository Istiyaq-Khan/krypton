import { spawn, ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  McpServerConfig,
  McpTool,
  McpToolSchema,
  StdioTransportConfig,
} from "@krypton/shared-types";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface IMcpClient {
  readonly serverName: string;
  readonly isConnected: boolean;
  connect(): Promise<void>;
  listTools(): Promise<McpTool[]>;
  callTool(
    name: string,
    args?: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<{ content: string; isError: boolean }>;
  ping(): Promise<boolean>;
  disconnect(): Promise<void>;
}

/**
 * Isolated Stdio MCP Client.
 * Connects to a local CLI or script MCP server via line-delimited JSON-RPC 2.0 over standard I/O.
 */
export class StdioMcpClient extends EventEmitter implements IMcpClient {
  public readonly serverName: string;
  private readonly config: StdioTransportConfig;
  private childProcess: ChildProcess | null = null;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private stdoutBuffer = "";
  private nextRequestId = 1;
  private _isConnected = false;
  private isIntentionalDisconnect = false;

  constructor(serverName: string, config: StdioTransportConfig) {
    super();
    this.serverName = serverName;
    this.config = config;
  }

  public get isConnected(): boolean {
    return this._isConnected;
  }

  public async connect(): Promise<void> {
    if (this._isConnected) return;
    this.isIntentionalDisconnect = false;

    return new Promise<void>((resolve, reject) => {
      try {
        const child = spawn(this.config.command, this.config.args, {
          env: { ...process.env, ...this.config.env },
          cwd: this.config.cwd || process.cwd(),
          stdio: ["pipe", "pipe", "pipe"],
          shell: false, // Strict: eliminate shell injection
        });

        this.childProcess = child;

        child.stdout?.on("data", (chunk: Buffer) => {
          this.handleStdoutChunk(chunk.toString("utf-8"));
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          this.emit("serverStderr", {
            serverName: this.serverName,
            data: chunk.toString("utf-8"),
          });
        });

        child.on("error", (err) => {
          this._isConnected = false;
          this.emit("error", err);
          if (!this._isConnected) reject(err);
        });

        child.on("exit", (code, signal) => {
          this._isConnected = false;
          this.rejectAllPending(
            new Error(`MCP server '${this.serverName}' exited with code ${code}, signal ${signal}`)
          );
          this.emit("serverExited", { code, signal });
        });

        // Initialize MCP handshake
        this._isConnected = true;
        this.sendRequest("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "krypton-mcp-host", version: "0.1.0" },
        })
          .then(() => {
            resolve();
          })
          .catch((err) => {
            this.disconnect();
            reject(err);
          });
      } catch (err) {
        this._isConnected = false;
        reject(err);
      }
    });
  }

  private handleStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        if (response.id !== undefined && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);
          clearTimeout(pending.timer);

          if (response.error) {
            pending.reject(
              new Error(
                `MCP error (${response.error.code}): ${response.error.message}`
              )
            );
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Skip non-JSON or debug log lines
      }
    }
  }

  private async sendRequest<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = 30_000
  ): Promise<T> {
    if (!this._isConnected || !this.childProcess?.stdin) {
      throw new Error(`MCP server '${this.serverName}' is not connected`);
    }

    const id = this.nextRequestId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (val: unknown) => void,
        reject,
        timer,
      });

      const messageStr = JSON.stringify(request) + "\n";
      this.childProcess!.stdin!.write(messageStr, "utf-8", (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
    });
  }

  public async listTools(): Promise<McpTool[]> {
    const result = await this.sendRequest<{ tools: unknown[] }>("tools/list");
    if (!result?.tools || !Array.isArray(result.tools)) {
      return [];
    }

    return result.tools.map((item: any) => {
      return McpToolSchema.parse({
        name: item.name,
        description: item.description ?? "",
        inputSchema: item.inputSchema ?? { type: "object", properties: {}, required: [] },
        serverName: this.serverName,
      });
    });
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> = {},
    timeoutMs = 30_000
  ): Promise<{ content: string; isError: boolean }> {
    const result = await this.sendRequest<{
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    }>("tools/call", { name, arguments: args }, timeoutMs);

    let contentText = "";
    if (result.content && Array.isArray(result.content)) {
      contentText = result.content
        .map((c) => (c.type === "text" ? c.text ?? "" : JSON.stringify(c)))
        .join("\n");
    } else if (typeof result === "string") {
      contentText = result;
    } else {
      contentText = JSON.stringify(result);
    }

    return {
      content: contentText,
      isError: Boolean(result.isError),
    };
  }

  public async ping(): Promise<boolean> {
    try {
      await this.sendRequest("ping", {}, 5000);
      return true;
    } catch {
      return false;
    }
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  public async disconnect(): Promise<void> {
    this.isIntentionalDisconnect = true;
    this._isConnected = false;
    this.rejectAllPending(new Error("MCP client disconnected"));

    if (this.childProcess) {
      try {
        this.childProcess.kill("SIGTERM");
      } catch {
        // Process might already be dead
      }
      this.childProcess = null;
    }
  }
}

/**
 * MCP Client Manager.
 * Coordinates multiple MCP servers, enforces process isolation, and discovers capabilities.
 */
export class McpClientManager {
  private clients = new Map<string, IMcpClient>();

  public async registerServer(config: McpServerConfig): Promise<IMcpClient> {
    if (this.clients.has(config.name)) {
      return this.clients.get(config.name)!;
    }

    let client: IMcpClient;
    if (config.transport.type === "stdio") {
      client = new StdioMcpClient(config.name, config.transport);
    } else {
      throw new Error(`Unsupported transport type: ${(config.transport as any).type}`);
    }

    if (config.enabled) {
      await client.connect();
    }

    this.clients.set(config.name, client);
    return client;
  }

  public getClient(serverName: string): IMcpClient | undefined {
    return this.clients.get(serverName);
  }

  public listClients(): IMcpClient[] {
    return Array.from(this.clients.values());
  }

  public async removeServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverName);
    }
  }

  public async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}
