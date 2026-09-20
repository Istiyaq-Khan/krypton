import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateDynamicResponse } from "../src/lib/dynamicInference"
import {
  WebSocketPacketSchema,
  ToolApprovalRequestedEvent,
  ToolExecutionEvent,
  TokenStreamChunk,
} from "@krypton/shared-types"

describe("Krypton Chat Dispatch & Live IPC Streaming Bridge", () => {
  describe("1. Dynamic Contextual Inference vs Mock Payloads", () => {
    it("produces distinct, query-specific dynamic responses for different objectives", () => {
      const fibonacciResp = generateDynamicResponse(
        "Calculate Fibonacci sequence in Rust",
        "CoderBot",
        "claude-3-7-sonnet",
        "projects/algo-lab"
      )

      const quantumResp = generateDynamicResponse(
        "Explain quantum computing principles",
        "Orchestrator",
        "5.6 Terra High",
        "projects/theory"
      )

      const astSafetyResp = generateDynamicResponse(
        "Verify AST safety guardrails across project",
        "TesterBot",
        "DeepSeek R1",
        "projects/core"
      )

      // Ensure each query returns distinct content tailored to the subject
      expect(fibonacciResp).toContain("Fibonacci Sequence Implementation in Rust")
      expect(fibonacciResp).toContain("pub fn fibonacci")
      expect(fibonacciResp).toContain("claude-3-7-sonnet")

      expect(quantumResp).toContain("Quantum Computing Overview")
      expect(quantumResp).toContain("Superposition")
      expect(quantumResp).toContain("Quantum Entanglement")

      expect(astSafetyResp).toContain("Dynamic AST Safety & Runtime Analysis")
      expect(astSafetyResp).toContain("zero-banned hazardous call policy")

      // Strictly verify no canned mock strings from legacy implementation
      expect(fibonacciResp).not.toContain("Analyzed objective and verified runtime AST guardrails.")
      expect(quantumResp).not.toContain("Analyzed objective and verified runtime AST guardrails.")
      expect(astSafetyResp).not.toContain("Analyzed objective and verified runtime AST guardrails.")

      // Verify outputs are completely distinct
      expect(fibonacciResp).not.toEqual(quantumResp)
      expect(fibonacciResp).not.toEqual(astSafetyResp)
      expect(quantumResp).not.toEqual(astSafetyResp)
    })

    it("incorporates active agent configuration and workspace path dynamically", () => {
      const res = generateDynamicResponse(
        "Scaffold autonomous actor scheduling",
        "ArchitectAgent",
        "Llama 3.3 70B",
        "/custom/workspace/krypton"
      )

      expect(res).toContain("ArchitectAgent")
      expect(res).toContain("Llama 3.3 70B")
      expect(res).toContain("/custom/workspace/krypton")
    })
  })

  describe("2. WebSocket IPC Wire Protocol & Reactive State Machine", () => {
    it("validates token_stream chunks parsing", () => {
      const chunk: TokenStreamChunk = {
        type: "token_stream",
        agentId: "11111111-1111-4111-a111-111111111111",
        taskId: "22222222-2222-4222-a222-222222222222",
        delta: "def compute(): return 42",
        isComplete: false,
        index: 12,
        timestamp: Date.now(),
      }

      const parsed = WebSocketPacketSchema.parse(chunk)
      expect(parsed.type).toBe("token_stream")
      if (parsed.type === "token_stream") {
        expect(parsed.delta).toBe("def compute(): return 42")
        expect(parsed.isComplete).toBe(false)
        expect(parsed.index).toBe(12)
      }
    })

    it("validates tool_approval_requested and resolves approval gate parameters", () => {
      const approvalPacket: ToolApprovalRequestedEvent = {
        type: "tool_approval_requested",
        approval: {
          id: "gate-98765",
          taskId: "task-100",
          agentId: "agent-coder",
          agentName: "CoderBot",
          type: "terminal_command",
          title: "Command Execution Approval",
          description: "CoderBot requested permission to execute tests",
          command: "pnpm test",
          status: "pending",
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      }

      const parsed = WebSocketPacketSchema.parse(approvalPacket)
      expect(parsed.type).toBe("tool_approval_requested")
      if (parsed.type === "tool_approval_requested") {
        expect(parsed.approval.id).toBe("gate-98765")
        expect(parsed.approval.command).toBe("pnpm test")
        expect(parsed.approval.agentName).toBe("CoderBot")
        expect(parsed.approval.status).toBe("pending")
      }
    })

    it("validates tool_execution event packet correctly", () => {
      const toolEvent: ToolExecutionEvent = {
        type: "tool_execution",
        taskId: "task-101",
        agentId: "agent-root",
        tool: {
          id: "tool-test-1",
          type: "ast_linter",
          title: "AST Safety Check",
          durationMs: 42,
          status: "success",
          stdout: "0 violations found",
          exitCode: 0,
        },
        timestamp: Date.now(),
      }

      const parsed = WebSocketPacketSchema.parse(toolEvent)
      expect(parsed.type).toBe("tool_execution")
      if (parsed.type === "tool_execution") {
        expect(parsed.tool.status).toBe("success")
        expect(parsed.tool.stdout).toBe("0 violations found")
      }
    })

    it("formats JSON-RPC resolveApproval payload for daemon unblocking", () => {
      function createResolveApprovalPayload(approvalId: string, approved: boolean) {
        return {
          jsonrpc: "2.0" as const,
          id: 12345,
          method: "resolveApproval",
          params: {
            approvalId,
            approved,
          },
        }
      }

      const approvePayload = createResolveApprovalPayload("gate-123", true)
      expect(approvePayload.method).toBe("resolveApproval")
      expect(approvePayload.params.approvalId).toBe("gate-123")
      expect(approvePayload.params.approved).toBe(true)

      const rejectPayload = createResolveApprovalPayload("gate-123", false)
      expect(rejectPayload.params.approved).toBe(false)
    })
  })
})
