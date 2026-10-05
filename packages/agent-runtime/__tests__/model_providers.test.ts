import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createModelProvider,
  resolveApiKey,
  getProviderRegistry,
  OpenAiGateway,
  AnthropicGateway,
  CustomGateway,
  FallbackProvider,
  OpenAiProtocolAdapter,
  AnthropicProtocolAdapter,
} from "../src/providers/index.js";
import { Message, McpTool } from "@krypton/shared-types";

describe("Decoupled Model Provider System", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("1. Namespaced Model Resolution (<provider_id>/<model_id>)", () => {
    it("resolves OpenAI model and extracts provider and model segments", async () => {
      const provider = await createModelProvider({
        model: "openai/gpt-4o",
        apiKey: "sk-proj-test",
      });

      expect(provider).toBeInstanceOf(OpenAiGateway);
      expect(provider.providerId).toBe("openai");
      expect(provider.model).toBe("gpt-4o");
    });

    it("resolves Anthropic model and extracts provider and model segments", async () => {
      const provider = await createModelProvider({
        model: "anthropic/claude-3-7-sonnet-20250219",
        apiKey: "sk-ant-test",
      });

      expect(provider).toBeInstanceOf(AnthropicGateway);
      expect(provider.providerId).toBe("anthropic");
      expect(provider.model).toBe("claude-3-7-sonnet-20250219");
    });

    it("resolves multi-slash models such as NVIDIA NIM meta/llama", async () => {
      const provider = await createModelProvider({
        model: "nvidia/meta/llama-3.3-70b-instruct",
        apiKey: "nvapi-test",
      });

      expect(provider).toBeInstanceOf(OpenAiGateway);
      expect(provider.providerId).toBe("nvidia");
      expect(provider.model).toBe("meta/llama-3.3-70b-instruct");
      expect(provider.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
    });

    it("resolves local Ollama models with relaxed credentials", async () => {
      const provider = await createModelProvider({
        model: "ollama/deepseek-r1:8b",
      });

      expect(provider).toBeInstanceOf(CustomGateway);
      expect(provider.providerId).toBe("ollama");
      expect(provider.model).toBe("deepseek-r1:8b");
    });

    it("supports legacy non-namespaced model strings with explicit provider", async () => {
      const provider = await createModelProvider({
        provider: "anthropic",
        model: "claude-3-5-haiku-20241022",
        apiKey: "sk-ant-test",
      });

      expect(provider).toBeInstanceOf(AnthropicGateway);
      expect(provider.providerId).toBe("anthropic");
      expect(provider.model).toBe("claude-3-5-haiku-20241022");
    });
  });

  describe("2. OpenAI Protocol Adapter Payload Transformation", () => {
    const adapter = new OpenAiProtocolAdapter();

    it("correctly maps standard agent messages to OpenAI chat completions format", () => {
      const messages: Message[] = [
        { id: "1", role: "system", content: "You are a coding assistant.", timestamp: Date.now() },
        { id: "2", role: "user", content: "What is 2 + 2?", timestamp: Date.now() },
        {
          id: "3",
          role: "assistant",
          content: "Let me compute.",
          toolCalls: [{ id: "call_1", name: "calc", arguments: { expr: "2+2" } }],
          timestamp: Date.now(),
        },
        {
          id: "4",
          role: "tool",
          content: "4",
          toolResults: [{ toolCallId: "call_1", toolName: "calc", content: "4", isError: false }],
          timestamp: Date.now(),
        },
      ];

      const mapped = adapter.mapMessages(messages);
      expect(mapped.length).toBe(4);
      expect(mapped[0]).toEqual({ role: "system", content: "You are a coding assistant." });
      expect(mapped[1]).toEqual({ role: "user", content: "What is 2 + 2?" });
      expect(mapped[2].role).toBe("assistant");
      expect((mapped[2] as any).tool_calls).toBeDefined();
      expect((mapped[2] as any).tool_calls[0].function.name).toBe("calc");
      expect(mapped[3]).toEqual({ role: "tool", content: "4", tool_call_id: "call_1" });
    });

    it("maps MCP tool specifications into OpenAI function definitions", () => {
      const tools: McpTool[] = [
        {
          name: "read_file",
          description: "Read file contents",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
        },
      ];

      const mapped = adapter.mapTools(tools);
      expect(mapped).toBeDefined();
      expect(mapped?.length).toBe(1);
      expect(mapped?.[0]).toEqual({
        type: "function",
        function: {
          name: "read_file",
          description: "Read file contents",
          parameters: tools[0].inputSchema,
        },
      });
    });
  });

  describe("3. Anthropic Protocol Adapter Payload Transformation", () => {
    const adapter = new AnthropicProtocolAdapter();

    it("separates system prompt into top-level parameter and formats user/assistant content blocks", () => {
      const messages: Message[] = [
        { id: "1", role: "system", content: "System safety instructions.", timestamp: Date.now() },
        { id: "2", role: "user", content: "Hello world", timestamp: Date.now() },
        {
          id: "3",
          role: "assistant",
          content: "Calling tool",
          toolCalls: [{ id: "call_abc", name: "search", arguments: { q: "krypton" } }],
          timestamp: Date.now(),
        },
        {
          id: "4",
          role: "tool",
          content: "search results",
          toolResults: [{ toolCallId: "call_abc", toolName: "search", content: "search results", isError: false }],
          timestamp: Date.now(),
        },
      ];

      const { systemPrompt, formattedMessages } = adapter.mapMessages(messages);
      expect(systemPrompt).toBe("System safety instructions.");
      expect(formattedMessages.length).toBe(3); // system was extracted
      expect(formattedMessages[0]).toEqual({ role: "user", content: "Hello world" });

      const assistantMsg = formattedMessages[1];
      expect(assistantMsg.role).toBe("assistant");
      expect(Array.isArray(assistantMsg.content)).toBe(true);
      expect((assistantMsg.content as any)[0]).toEqual({ type: "text", text: "Calling tool" });
      expect((assistantMsg.content as any)[1]).toEqual({
        type: "tool_use",
        id: "call_abc",
        name: "search",
        input: { q: "krypton" },
      });

      const toolResultMsg = formattedMessages[2];
      expect(toolResultMsg.role).toBe("user");
      expect((toolResultMsg.content as any)[0]).toEqual({
        type: "tool_result",
        tool_use_id: "call_abc",
        content: "search results",
        is_error: false,
      });
    });

    it("maps MCP tool specifications into Anthropic input_schema definitions", () => {
      const tools: McpTool[] = [
        {
          name: "bash",
          description: "Execute bash command",
          inputSchema: {
            type: "object",
            properties: { command: { type: "string" } },
            required: ["command"],
          },
        },
      ];

      const mapped = adapter.mapTools(tools);
      expect(mapped).toBeDefined();
      expect(mapped?.[0]).toEqual({
        name: "bash",
        description: "Execute bash command",
        input_schema: tools[0].inputSchema,
      });
    });
  });

  describe("4. Model Fallback Chain & Resilience", () => {
    it("seamlessly fails over to secondary provider when primary encounters 429 rate limit", async () => {
      const primaryMock = {
        providerId: "openai",
        model: "gpt-4o",
        generate: vi.fn().mockRejectedValue(new Error("Rate limit exceeded (429): Quota exhausted")),
      };

      const fallbackMock = {
        providerId: "groq",
        model: "llama-3.3-70b-versatile",
        generate: vi.fn().mockResolvedValue({
          message: { id: "msg_1", role: "assistant", content: "Fallback response from Groq.", timestamp: Date.now() },
          toolCalls: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }),
      };

      const fallbackProvider = new FallbackProvider({
        primary: primaryMock as any,
        fallbacks: [fallbackMock as any],
      });

      const res = await fallbackProvider.generate({
        agentId: "agent-1",
        messages: [{ id: "1", role: "user", content: "Hi", timestamp: Date.now() }],
      });

      expect(primaryMock.generate).toHaveBeenCalledTimes(1);
      expect(fallbackMock.generate).toHaveBeenCalledTimes(1);
      expect(res.message.content).toBe("Fallback response from Groq.");
    });

    it("throws aggregated error when all providers in fallback chain fail", async () => {
      const primaryMock = {
        providerId: "openai",
        model: "gpt-4o",
        generate: vi.fn().mockRejectedValue(new Error("503 Service Unavailable")),
      };

      const fallbackMock = {
        providerId: "anthropic",
        model: "claude-3-7-sonnet",
        generate: vi.fn().mockRejectedValue(new Error("500 Internal Error")),
      };

      const fallbackProvider = new FallbackProvider({
        primary: primaryMock as any,
        fallbacks: [fallbackMock as any],
      });

      await expect(
        fallbackProvider.generate({
          agentId: "agent-1",
          messages: [{ id: "1", role: "user", content: "Hi", timestamp: Date.now() }],
        })
      ).rejects.toThrow("All providers in fallback chain failed");
    });
  });

  describe("5. Secret Resolution", () => {
    it("resolves environment variable keys correctly", async () => {
      process.env.DEEPSEEK_API_KEY = "test-deepseek-env-key";
      const key = await resolveApiKey("deepseek");
      expect(key).toBe("test-deepseek-env-key");
      delete process.env.DEEPSEEK_API_KEY;
    });

    it("returns provider name as placeholder for local runtimes without cloud key requirements", async () => {
      const key = await resolveApiKey("ollama");
      expect(key).toBe("ollama");
    });
  });
});
