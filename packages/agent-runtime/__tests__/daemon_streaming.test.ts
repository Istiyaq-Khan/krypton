import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { KryptonDaemonServer, generateDynamicResponse } from "../src/daemon.js"
import { WebSocketPacket } from "@krypton/shared-types"

describe("Daemon IPC Streaming Bridge & Dynamic Task Execution", () => {
  let daemon: KryptonDaemonServer
  let broadcastedPackets: WebSocketPacket[] = []

  beforeEach(() => {
    broadcastedPackets = []
    daemon = new KryptonDaemonServer()
    // Intercept broadcast to capture packets without network socket
    daemon.broadcast = (packet: WebSocketPacket) => {
      broadcastedPackets.push(packet)
    }
  })

  afterEach(async () => {
    await daemon.stop()
  })

  it("dynamically generates distinct responses for different user objectives", () => {
    const resp1 = generateDynamicResponse(
      "Calculate Fibonacci sequence in Rust",
      "CoderBot",
      "claude-3-7-sonnet"
    )
    const resp2 = generateDynamicResponse(
      "Explain quantum computing principles",
      "Orchestrator",
      "5.6 Terra High"
    )
    const resp3 = generateDynamicResponse(
      "Run AST safety linter across repository",
      "TesterBot",
      "DeepSeek R1"
    )

    expect(resp1).toContain("Fibonacci Sequence Implementation in Rust")
    expect(resp2).toContain("Quantum Computing Overview")
    expect(resp3).toContain("Dynamic AST Safety & Runtime Analysis")

    // Verify distinct responses
    expect(resp1).not.toEqual(resp2)
    expect(resp2).not.toEqual(resp3)
  })

  it("dispatches startTask and streams token_stream chunks and task updates", async () => {
    const res = await daemon.handleRpcCall({
      jsonrpc: "2.0",
      id: 10,
      method: "startTask",
      params: {
        prompt: "Explain quantum superposition",
        agentName: "Orchestrator",
        model: "5.6 Terra High",
      },
    })

    expect(res.error).toBeUndefined()
    expect(res.result).toBeDefined()
    const r = res.result as { taskId: string; status: string }
    expect(r.taskId).toBeDefined()
    expect(r.status).toBe("in_progress")

    // Allow streaming loop to progress
    await new Promise((resolve) => setTimeout(resolve, 800))

    const tokens = broadcastedPackets.filter((p) => p.type === "token_stream")
    expect(tokens.length).toBeGreaterThan(0)

    const treeUpdates = broadcastedPackets.filter((p) => p.type === "task_tree_updated")
    expect(treeUpdates.length).toBeGreaterThan(0)

    const logs = broadcastedPackets.filter((p) => p.type === "agent_log")
    expect(logs.length).toBeGreaterThan(0)
  })

  it("pauses execution for tool approval and resumes upon resolveApproval RPC", async () => {
    const res = await daemon.handleRpcCall({
      jsonrpc: "2.0",
      id: 20,
      method: "startTask",
      params: {
        prompt: "pnpm test",
        agentName: "CoderBot",
        askForApproval: true,
      },
    })

    expect(res.result).toBeDefined()

    // Wait for approval event to be broadcast
    await new Promise((resolve) => setTimeout(resolve, 150))

    const approvalEvent = broadcastedPackets.find((p) => p.type === "tool_approval_requested")
    expect(approvalEvent).toBeDefined()
    if (approvalEvent && approvalEvent.type === "tool_approval_requested") {
      const approvalId = approvalEvent.approval.id
      expect(approvalId).toBeDefined()

      // Resolve the approval via RPC
      const resolveRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 21,
        method: "resolveApproval",
        params: {
          approvalId,
          approved: true,
        },
      })

      expect((resolveRes.result as any)?.approved).toBe(true)

      // Wait for execution completion
      await new Promise((resolve) => setTimeout(resolve, 500))

      const toolExec = broadcastedPackets.find((p) => p.type === "tool_execution")
      expect(toolExec).toBeDefined()
      if (toolExec && toolExec.type === "tool_execution") {
        expect(toolExec.tool.status).toBe("success")
      }
    }
  })
})
