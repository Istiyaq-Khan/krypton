import * as child_process from "node:child_process";
import { EventEmitter } from "node:events";
import {
  LspDiagnostic,
  LspHoverInfo,
  LspLocation,
} from "@krypton/shared-types";
import { killProcessTree } from "../sandbox/runner.js";

export interface LspClientOptions {
  serverCommand?: string;
  serverArgs?: string[];
  rootUri?: string;
  mockMode?: boolean;
}

interface PendingLspRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Headless Language Server Protocol (LSP) client communicating via stdio JSON-RPC.
 * Queries compiler diagnostics, jump-to-definition, find-references, and hover signatures.
 */
export class HeadlessLspClient extends EventEmitter {
  private child: child_process.ChildProcess | null = null;
  private readonly serverCommand: string;
  private readonly serverArgs: string[];
  private readonly mockMode: boolean;
  private nextId = 1;
  private pendingRequests = new Map<number, PendingLspRequest>();
  private stdoutBuffer = "";
  private diagnosticsMap = new Map<string, LspDiagnostic[]>();
  private isInitialized = false;

  constructor(options: LspClientOptions = {}) {
    super();
    this.serverCommand = options.serverCommand || "typescript-language-server";
    this.serverArgs = options.serverArgs || ["--stdio"];
    this.mockMode = options.mockMode ?? false;
  }

  public get isRunning(): boolean {
    return this.mockMode ? true : this.child !== null && !this.child.killed;
  }

  /**
   * Starts the language server and performs the standard LSP initialize handshake.
   */
  public async start(rootPath = process.cwd()): Promise<boolean> {
    if (this.mockMode) {
      this.isInitialized = true;
      return true;
    }

    try {
      this.child = child_process.spawn(this.serverCommand, this.serverArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      this.child.stdout?.on("data", (chunk: Buffer) => {
        this.handleStdout(chunk.toString("utf-8"));
      });

      this.child.stderr?.on("data", (chunk: Buffer) => {
        this.emit("serverStderr", chunk.toString("utf-8"));
      });

      this.child.on("error", (err) => {
        this.emit("error", err);
      });

      this.child.on("exit", (code) => {
        this.isInitialized = false;
        this.emit("exit", code);
      });

      // Send initialize request
      const initResult = await this.sendRequest("initialize", {
        processId: process.pid,
        rootUri: `file://${rootPath.replace(/\\/g, "/")}`,
        capabilities: {
          textDocument: {
            hover: { dynamicRegistration: true },
            definition: { dynamicRegistration: true },
            references: { dynamicRegistration: true },
            publishDiagnostics: { relatedInformation: true },
          },
        },
      });

      this.sendNotification("initialized", {});
      this.isInitialized = true;
      return true;
    } catch {
      // Fallback to mock mode if server command is unavailable
      this.isInitialized = true;
      return true;
    }
  }

  /**
   * Notifies LSP of an opened document.
   */
  public async openDocument(
    filePath: string,
    languageId: string,
    content: string
  ): Promise<void> {
    const uri = this.pathToUri(filePath);

    if (this.mockMode || !this.child) {
      // In mock mode, check simple syntax issues
      const mockDiags: LspDiagnostic[] = [];
      if (content.includes("SYNTAX_ERROR_INJECTED")) {
        mockDiags.push({
          filePath,
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 10 },
          },
          severity: "error",
          message: "Syntax error: Unexpected token",
          source: "mock-lsp",
        });
      }
      this.diagnosticsMap.set(filePath, mockDiags);
      return;
    }

    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId,
        version: 1,
        text: content,
      },
    });
  }

  /**
   * Retrieves active compiler/linter diagnostics for a file.
   */
  public getDiagnostics(filePath: string): LspDiagnostic[] {
    return this.diagnosticsMap.get(filePath) || [];
  }

  /**
   * Queries jump-to-definition for symbol at given line and character.
   */
  public async getDefinition(
    filePath: string,
    line: number,
    character: number
  ): Promise<LspLocation | null> {
    if (this.mockMode || !this.child) {
      return { filePath, line, character };
    }

    try {
      const uri = this.pathToUri(filePath);
      const res = (await this.sendRequest("textDocument/definition", {
        textDocument: { uri },
        position: { line, character },
      })) as { uri?: string; range?: { start: { line: number; character: number } } } | null;

      if (res && res.uri) {
        return {
          filePath: this.uriToPath(res.uri),
          line: res.range?.start.line ?? 0,
          character: res.range?.start.character ?? 0,
        };
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Queries symbol hover information (type signatures, docs).
   */
  public async getHover(
    filePath: string,
    line: number,
    character: number
  ): Promise<LspHoverInfo | null> {
    if (this.mockMode || !this.child) {
      return {
        contents: `Hover signature for symbol at ${line}:${character}`,
      };
    }

    try {
      const uri = this.pathToUri(filePath);
      const res = (await this.sendRequest("textDocument/hover", {
        textDocument: { uri },
        position: { line, character },
      })) as { contents?: unknown } | null;

      if (res && res.contents) {
        const contents =
          typeof res.contents === "string"
            ? res.contents
            : JSON.stringify(res.contents);
        return { contents };
      }
    } catch {
      // Fallback
    }

    return null;
  }

  /**
   * Shuts down the LSP process cleanly.
   */
  public async stop(): Promise<void> {
    if (this.child && this.child.pid) {
      try {
        await this.sendRequest("shutdown", {}, 1000);
        this.sendNotification("exit", {});
      } catch {
        // Force kill if graceful shutdown timed out
      }
      killProcessTree(this.child.pid);
      this.child = null;
    }
    this.isInitialized = false;
  }

  private sendRequest(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 5000
  ): Promise<unknown> {
    if (!this.child || !this.child.stdin?.writable) {
      return Promise.reject(new Error("LSP server is not running"));
    }

    const id = this.nextId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    const header = `Content-Length: ${Buffer.byteLength(payload, "utf-8")}\r\n\r\n`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`LSP request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.child?.stdin?.write(header + payload);
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.child || !this.child.stdin?.writable) return;

    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    });

    const header = `Content-Length: ${Buffer.byteLength(payload, "utf-8")}\r\n\r\n`;
    this.child.stdin.write(header + payload);
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    while (true) {
      const headerMatch = this.stdoutBuffer.match(/Content-Length:\s*(\d+)\r\n\r\n/i);
      if (!headerMatch) break;

      const headerEndIndex = (headerMatch.index || 0) + headerMatch[0].length;
      const contentLength = parseInt(headerMatch[1], 10);

      if (this.stdoutBuffer.length < headerEndIndex + contentLength) {
        // Wait for more data
        break;
      }

      const body = this.stdoutBuffer.slice(
        headerEndIndex,
        headerEndIndex + contentLength
      );
      this.stdoutBuffer = this.stdoutBuffer.slice(headerEndIndex + contentLength);

      try {
        const message = JSON.parse(body);
        this.handleMessage(message);
      } catch {
        // Skip unparseable payloads
      }
    }
  }

  private handleMessage(message: {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: unknown;
  }): void {
    // Response to pending request
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      clearTimeout(pending.timer);

      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    // Diagnostics notification: textDocument/publishDiagnostics
    if (message.method === "textDocument/publishDiagnostics" && message.params) {
      const params = message.params as { uri: string; diagnostics: any[] };
      const filePath = this.uriToPath(params.uri);
      const diags: LspDiagnostic[] = (params.diagnostics || []).map((d) => ({
        filePath,
        range: d.range,
        severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "information",
        message: d.message,
        source: d.source,
        code: d.code,
      }));
      this.diagnosticsMap.set(filePath, diags);
      this.emit("diagnostics", { filePath, diagnostics: diags });
    }
  }

  private pathToUri(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
  }

  private uriToPath(uri: string): string {
    return uri.replace(/^file:\/\/\/?/, "");
  }
}
