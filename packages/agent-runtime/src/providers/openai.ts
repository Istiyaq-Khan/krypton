import {
  Message,
  ToolCall,
  McpTool,
  TokenStreamChunk,
  sanitizeBaseUrl,
} from "@krypton/shared-types";
import { LLMProvider, GenerateOptions, GenerateResult } from "./types.js";

export interface OpenAiGatewayOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  maxRetries?: number;
}

/**
 * OpenAI-compatible Gateway supporting OpenAI, DeepSeek, Groq, vLLM, and Ollama.
 */
export class OpenAiGateway implements LLMProvider {
  public readonly providerId = "openai";
  public readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly maxRetries: number;

  constructor(options: OpenAiGatewayOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = sanitizeBaseUrl(options.baseUrl || "https://api.openai.com/v1");
    this.defaultHeaders = options.defaultHeaders || {};
    this.maxRetries = options.maxRetries ?? 3;
  }

  private mapMessagesToOpenAi(messages: Message[]): Record<string, unknown>[] {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formatted.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }

      if (msg.role === "tool" && msg.toolResults && msg.toolResults[0]) {
        formatted.tool_call_id = msg.toolResults[0].toolCallId;
      }

      return formatted;
    });
  }

  private mapToolsToOpenAi(tools?: McpTool[]): Record<string, unknown>[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  private async fetchWithBackoff(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const res = await fetch(url, options);

      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        if (attempt <= this.maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return this.fetchWithBackoff(url, options, attempt + 1);
        }
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(
          `OpenAI API request failed (${res.status} ${res.statusText}): ${errorText}`
        );
      }

      return res;
    } catch (err) {
      if (attempt <= this.maxRetries && !(err instanceof Error && err.name === "AbortError")) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.fetchWithBackoff(url, options, attempt + 1);
      }
      throw err;
    }
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const endpoint = `${this.baseUrl}/chat/completions`;
    const tools = this.mapToolsToOpenAi(options.tools);
    const messages = this.mapMessagesToOpenAi(options.messages);

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      stream: Boolean(options.onToken),
    };

    if (options.maxTokens) {
      requestBody.max_tokens = options.maxTokens;
    }
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.defaultHeaders,
    };

    const response = await this.fetchWithBackoff(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: options.abortSignal,
    });

    if (!options.onToken) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const messageContent = choice?.message?.content || "";
      const rawToolCalls = choice?.message?.tool_calls || [];

      const toolCalls: ToolCall[] = rawToolCalls.map((tc: any) => {
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          args = {};
        }
        return {
          id: tc.id || crypto.randomUUID(),
          name: tc.function?.name || "",
          arguments: args,
        };
      });

      return {
        message: {
          role: "assistant",
          content: messageContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          timestamp: Date.now(),
        },
        toolCalls,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    }

    // Handle streaming
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response body reader for streaming");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let accumulatedContent = "";
    let tokenIndex = 0;
    const streamedToolCallsMap = new Map<number, { id: string; name: string; args: string }>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;

          if (delta?.content) {
            accumulatedContent += delta.content;
            const chunk: TokenStreamChunk = {
              type: "token_stream",
              agentId: options.agentId,
              taskId: options.taskId,
              delta: delta.content,
              isComplete: false,
              index: tokenIndex++,
              timestamp: Date.now(),
            };
            options.onToken(chunk);
          }

          if (delta?.tool_calls) {
            for (const tcDelta of delta.tool_calls) {
              const idx = tcDelta.index ?? 0;
              const existing = streamedToolCallsMap.get(idx) || { id: "", name: "", args: "" };
              if (tcDelta.id) existing.id = tcDelta.id;
              if (tcDelta.function?.name) existing.name += tcDelta.function.name;
              if (tcDelta.function?.arguments) existing.args += tcDelta.function.arguments;
              streamedToolCallsMap.set(idx, existing);
            }
          }
        } catch {
          // Ignore partial or invalid JSON lines in stream
        }
      }
    }

    // Final complete chunk notification
    options.onToken({
      type: "token_stream",
      agentId: options.agentId,
      taskId: options.taskId,
      delta: "",
      isComplete: true,
      index: tokenIndex,
      timestamp: Date.now(),
    });

    const parsedToolCalls: ToolCall[] = [];
    for (const item of streamedToolCallsMap.values()) {
      let args = {};
      try {
        args = JSON.parse(item.args || "{}");
      } catch {
        args = {};
      }
      parsedToolCalls.push({
        id: item.id || crypto.randomUUID(),
        name: item.name,
        arguments: args,
      });
    }

    return {
      message: {
        role: "assistant",
        content: accumulatedContent,
        toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
        timestamp: Date.now(),
      },
      toolCalls: parsedToolCalls,
      usage: {
        promptTokens: 0,
        completionTokens: tokenIndex,
        totalTokens: tokenIndex,
      },
    };
  }
}
