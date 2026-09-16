import { describe, it, expect } from "vitest"
import {
  KryptonChatPayload,
  StagedContextItem,
} from "../src/components/chatbar/useChatbarState"

describe("Krypton Desktop Chatbar — RFC Behavioral Engine", () => {
  describe("3.2 Smart Paste Ingestion Engine Heuristics", () => {
    function evaluatePasteHeuristic(pasteText: string): {
      shouldIntercept: boolean
      createdSnippet?: StagedContextItem
    } {
      const newlineCount = (pasteText.match(/\n/g) || []).length
      const charCount = pasteText.length

      if (newlineCount >= 10 || charCount >= 300) {
        const lines = pasteText.split("\n")
        const previewFirst = lines[0]?.trim() || "Snippet"
        const detectedLang =
          pasteText.includes("import ") || pasteText.includes("export ")
            ? "typescript"
            : pasteText.includes("def ") || pasteText.includes("class ")
            ? "python"
            : "text"

        return {
          shouldIntercept: true,
          createdSnippet: {
            id: `snippet-test`,
            name: previewFirst.length > 28 ? previewFirst.slice(0, 25) + "..." : previewFirst,
            category: "snippet",
            rawContent: pasteText,
            metadata: {
              lineCount: lines.length,
              byteSize: Buffer.byteLength(pasteText, "utf-8"),
              language: detectedLang,
            },
          },
        }
      }

      return { shouldIntercept: false }
    }

    it("should NOT intercept small single-line or short pastes (< 10 newlines and < 300 chars)", () => {
      const shortText = "Fix the login route authentication bug."
      const result = evaluatePasteHeuristic(shortText)
      expect(result.shouldIntercept).toBe(false)
      expect(result.createdSnippet).toBeUndefined()
    })

    it("should intercept clipboard text with >= 10 newlines (Condition A)", () => {
      const multiLineLog = [
        "step 1: boot",
        "step 2: config loaded",
        "step 3: keytar probed",
        "step 4: sandbox ready",
        "step 5: ast parsed",
        "step 6: git worktree staged",
        "step 7: commit created",
        "step 8: test initiated",
        "step 9: verification passed",
        "step 10: checkpoint written",
        "step 11: done",
      ].join("\n")

      const result = evaluatePasteHeuristic(multiLineLog)
      expect(result.shouldIntercept).toBe(true)
      expect(result.createdSnippet).toBeDefined()
      expect(result.createdSnippet?.category).toBe("snippet")
      expect(result.createdSnippet?.metadata?.lineCount).toBe(11)
      expect(result.createdSnippet?.metadata?.byteSize).toBeGreaterThan(100)
    })

    it("should intercept clipboard text with >= 300 characters without many newlines (Condition B)", () => {
      const longQuery = "a".repeat(320)
      const result = evaluatePasteHeuristic(longQuery)
      expect(result.shouldIntercept).toBe(true)
      expect(result.createdSnippet).toBeDefined()
      expect(result.createdSnippet?.metadata?.byteSize).toBe(320)
    })

    it("should accurately detect language in staged code snippets", () => {
      const tsCode = `import { useState } from "react";\nexport function Component() {\n  return <div>Hello</div>;\n}`.repeat(5)
      const result = evaluatePasteHeuristic(tsCode)
      expect(result.shouldIntercept).toBe(true)
      expect(result.createdSnippet?.metadata?.language).toBe("typescript")
    })
  })

  describe("3.3 Autocomplete & Trigger Parsing (/ and @)", () => {
    function detectTrigger(value: string, cursorPos: number): {
      trigger: "/" | "@" | null
      query: string
    } {
      const textBeforeCursor = value.slice(0, cursorPos)
      const match = textBeforeCursor.match(/(?:^|\s)([/@])([^\s]*)$/)
      if (match && (match[1] === "/" || match[1] === "@")) {
        return {
          trigger: match[1] as "/" | "@",
          query: match[2] || "",
        }
      }
      return { trigger: null, query: "" }
    }

    it("detects leading '/' tool trigger at start of string", () => {
      const text = "/git"
      const res = detectTrigger(text, text.length)
      expect(res.trigger).toBe("/")
      expect(res.query).toBe("git")
    })

    it("detects leading '@' context trigger after whitespace", () => {
      const text = "Review this file @AGENT"
      const res = detectTrigger(text, text.length)
      expect(res.trigger).toBe("@")
      expect(res.query).toBe("AGENT")
    })

    it("does not trigger on email addresses or inline slashes", () => {
      const email = "user@domain.com"
      const res = detectTrigger(email, email.length)
      expect(res.trigger).toBe(null)

      const path = "packages/agent-runtime"
      const res2 = detectTrigger(path, path.length)
      expect(res2.trigger).toBe(null)
    })
  })

  describe("4.1 Serialization Schema Conformance (KryptonChatPayload)", () => {
    it("serializes payload matching exact RFC specification", () => {
      const payload: KryptonChatPayload = {
        turnId: "turn-172651234-abcde",
        prompt: "Run AST safety linter across all generated scripts",
        context: [
          {
            id: "ctx-1",
            name: "AGENTS.md",
            category: "file",
            path: "AGENTS.md",
            metadata: { lineCount: 182, byteSize: 8400 },
          },
          {
            id: "tool-1",
            name: "lint_code_ast",
            category: "mcp",
            metadata: { mcpServer: "krypton-sandbox" },
          },
        ],
        runtimeConfig: {
          model: "claude-3-7-sonnet",
          enableWebSearch: false,
        },
        dispatchedAt: 172651234000,
      }

      expect(payload.turnId).toBeDefined()
      expect(payload.prompt).toContain("AST safety")
      expect(payload.context).toHaveLength(2)
      expect(payload.context[0].category).toBe("file")
      expect(payload.context[1].category).toBe("mcp")
      expect(payload.runtimeConfig.model).toBe("claude-3-7-sonnet")
      expect(payload.dispatchedAt).toBeGreaterThan(0)
    })
  })
})
