import { describe, it, expect, vi } from "vitest"
import { KryptonIpcClient } from "../src/ipc-client.js"
import {
  WINDOWS_NAMED_PIPE,
  POSIX_DOMAIN_SOCKET,
  TaskNode,
  ClarificationRequestedEvent,
} from "@krypton/shared-types"

describe("Phase 6: Krypton Terminal CLI Client", () => {
  it("resolves the correct platform IPC endpoint", () => {
    const client = new KryptonIpcClient()
    const endpoint = client.getPipeEndpoint()

    if (process.platform === "win32") {
      expect(endpoint).toBe(WINDOWS_NAMED_PIPE)
    } else {
      expect(endpoint).toBe(POSIX_DOMAIN_SOCKET)
    }
  })

  it("handles RPC call methods via mock fallback when offline", async () => {
    const client = new KryptonIpcClient()

    const taskResult = await client.startTask("Run linter and tests")
    expect(taskResult.taskId).toBe("mock-task-1")
    expect(taskResult.initialDag.length).toBe(2)

    const agents = await client.listAgents()
    expect(agents.length).toBeGreaterThan(0)
    expect(agents[0].name).toBe("default")

    const tools = await client.listTools()
    expect(tools.length).toBeGreaterThan(0)
    expect(tools[0].name).toBe("github")

    const diff = await client.getVcsDiff()
    expect(diff).toContain("diff --git")

    const merge = await client.mergeVcs("wt-123")
    expect(merge.success).toBe(true)
    expect(merge.commitHash).toBeDefined()
  })

  it("dispatches stream events to listeners", () => {
    let treeUpdated: TaskNode[] = []
    let receivedClarification: ClarificationRequestedEvent | null = null
    let logReceived = ""
    let tokenStream = ""

    const client = new KryptonIpcClient({
      onTaskTreeUpdate: (tasks) => {
        treeUpdated = tasks
      },
      onClarificationRequest: (event) => {
        receivedClarification = event
      },
      onLog: (level, msg) => {
        logReceived = `${level}: ${msg}`
      },
      onTokenChunk: (delta) => {
        tokenStream += delta
      },
    })

    // Simulate incoming stream payloads
    const anyClient = client as any

    anyClient.handleIncomingPayload({
      type: "task_tree_updated",
      serializedTasks: {
        t1: { id: "t1", title: "Task 1", status: "completed" },
      },
    })
    expect(treeUpdated.length).toBe(1)
    expect(treeUpdated[0].title).toBe("Task 1")

    anyClient.handleIncomingPayload({
      type: "clarification_requested",
      request: {
        requestId: "req-1",
        agentId: "agent-1",
        prompt: "Proceed?",
        options: [],
        allowFreeform: true,
        timeoutMs: 30000,
        status: "pending",
        createdAt: Date.now(),
      },
      timestamp: Date.now(),
    })
    expect(receivedClarification?.request.prompt).toBe("Proceed?")

    anyClient.handleIncomingPayload({
      type: "agent_log",
      level: "info",
      message: "Worker active",
    })
    expect(logReceived).toBe("info: Worker active")

    anyClient.handleIncomingPayload({
      type: "token_stream",
      delta: "Thinking...",
    })
    expect(tokenStream).toBe("Thinking...")
  })
})
