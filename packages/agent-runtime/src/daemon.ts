import * as net from "node:net"
import * as fs from "node:fs"
import {
  WINDOWS_NAMED_PIPE,
  POSIX_DOMAIN_SOCKET,
  DEFAULT_RPC_PORT,
  JsonRpcRequest,
  JsonRpcResponse,
} from "@krypton/shared-types"
import { bootstrapKryptonHome, resolveKryptonHome } from "./filesystem/bootstrap.js"

export class KryptonDaemonServer {
  private server: net.Server | null = null
  private pipePath: string
  private isRunning = false

  constructor() {
    this.pipePath = process.platform === "win32" ? WINDOWS_NAMED_PIPE : POSIX_DOMAIN_SOCKET
  }

  public async start(): Promise<void> {
    await bootstrapKryptonHome()

    // On Unix, clean up stale domain socket
    if (process.platform !== "win32" && fs.existsSync(this.pipePath)) {
      try {
        fs.unlinkSync(this.pipePath)
      } catch {
        // ignore
      }
    }

    this.server = net.createServer((socket) => {
      let buffer = ""

      socket.on("data", async (chunk) => {
        buffer += chunk.toString("utf-8")
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const req: JsonRpcRequest = JSON.parse(trimmed)
            const res = await this.handleRpcCall(req)
            socket.write(JSON.stringify(res) + "\n")
          } catch (err: any) {
            socket.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32700, message: err.message },
              }) + "\n"
            )
          }
        }
      })
    })

    return new Promise((resolve, reject) => {
      this.server?.listen(this.pipePath, () => {
        this.isRunning = true
        console.log(`⚡ Krypton Daemon running on ${this.pipePath}`)
        resolve()
      })

      this.server?.on("error", (err) => {
        console.error(`Krypton Daemon error: ${err.message}`)
        reject(err)
      })
    })
  }

  private async handleRpcCall(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = req

    try {
      let result: any = { success: true }

      switch (method) {
        case "ping":
          result = { pong: true, timestamp: Date.now() }
          break
        case "startTask":
          result = {
            taskId: "task-" + Date.now(),
            status: "in_progress",
            initialDag: [
              { id: "step-1", title: "Analyze objective", status: "completed" },
              { id: "step-2", title: "Synthesize actions", status: "in_progress" },
            ],
          }
          break
        case "resolveClarification":
          result = { resolved: true }
          break
        case "getVcsDiff":
          result = "diff --git a/worktree b/worktree\n+ // verified changes"
          break
        case "mergeVcs":
          result = { success: true, commitHash: "feat-" + Date.now().toString(16) }
          break
        case "listAgents":
          result = [
            { name: "default", model: "claude-3-7-sonnet", tools: ["fs", "bash", "browser"] },
          ]
          break
        case "createAgent":
          result = { agentDir: `${resolveKryptonHome()}/agents/${(params as any)?.name || "custom"}` }
          break
        case "listTools":
          result = [
            { name: "github", description: "GitHub MCP Server", type: "mcp" },
            { name: "terminal", description: "PTY Session Host", type: "system" },
          ]
          break
        case "installTool":
          result = { success: true }
          break
        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method '${method}' not found` },
          }
      }

      return {
        jsonrpc: "2.0",
        id,
        result,
      }
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: err.message },
      }
    }
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}

if (process.argv[1]?.endsWith("daemon.js") || process.argv[1]?.endsWith("daemon")) {
  const daemon = new KryptonDaemonServer()
  daemon.start().catch((err) => {
    console.error("Failed to start daemon:", err)
    process.exit(1)
  })

  process.on("SIGINT", () => daemon.stop().then(() => process.exit(0)))
  process.on("SIGTERM", () => daemon.stop().then(() => process.exit(0)))
}
