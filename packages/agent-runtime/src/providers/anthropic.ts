import {
  Message,
  ToolCall,
  McpTool,
  TokenStreamChunk,
} from "@krypton/shared-types";
import { LLMProvider, GenerateOptions, GenerateResult } from "./types.js";

export interface AnthropicGatewayOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  maxRetries?: number;
}

/**
 * Anthropic Native Messages Gateway supporting Claude 3, 3.5, and 3.7 models.
 */
export class AnthropicGateway implements LLMProvider {
  public readonly providerId = "anthropic";
  public readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly maxRetries: number;

  constructor(options: AnthropicGatewayOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.defaultHeaders = options.defaultHeaders || {};
    this.maxRetries = options.maxRetries ?? 3;
  }

  private mapMessagesToAnthropic(messages: Message[]): {
    systemPrompt?: string;
    anthropicMessages: Record<string, unknown>[];
  } {
    let systemPrompt: string | undefined;
    const anthropicMessages: Record<string, unknown>[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content;
        continue;
      }

      if (msg.role === "tool") {
        // In Anthropic, tool results are returned in a user message with tool_result content blocks
        const toolUseId = msg.toolResults?.[0]?.toolCallId || "unknown";
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseId,
              content: msg.content,
              is_error: msg.toolResults?.[0]?.isError ?? false,
            },
          ],
        });
        continue;
      }

      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        const contentBlocks: Record<string, unknown>[] = [];
        if (msg.content) {
          contentBlocks.push({ type: "text", text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          contentBlocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        anthropicMessages.push({
          role: "assistant",
          content: contentBlocks,
        });
        continue;
      }

      anthropicMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }

    return { systemPrompt, anthropicMessages };
  }

  private mapToolsToAnthropic(tools?: McpTool[]): Record<string, unknown>[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
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
          `Anthropic API request failed (${res.status} ${res.statusText}): ${errorText}`
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
    const endpoint = `${this.baseUrl}/messages`;
    const { systemPrompt, anthropicMessages } = this.mapMessagesToAnthropic(options.messages);
    const tools = this.mapToolsToAnthropic(options.tools);

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: anthropicMessages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      stream: Boolean(options.onToken),
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
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
      let textContent = "";
      const toolCalls: ToolCall[] = [];

      for (const block of data.content || []) {
        if (block.type === "text") {
          textContent += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input || {},
          });
        }
      }

      return {
        message: {
          role: "assistant",
          content: textContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          timestamp: Date.now(),
        },
        toolCalls,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    }

    // Streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response body reader for streaming");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let accumulatedContent = "";
    let tokenIndex = 0;
    const currentToolCalls: { id: string; name: string; inputJson: string }[] = [];
    let currentBlock: { type: string; index: number } | null = null;

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

        try {
          const event = JSON.parse(dataStr);

          if (event.type === "content_block_start") {
            currentBlock = { type: event.content_block?.type, index: event.index };
            if (event.content_block?.type === "tool_use") {
              currentToolCalls.push({
                id: event.content_block.id,
                name: event.content_block.name,
                inputJson: "",
              });
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta") {
              const text = event.delta.text;
              accumulatedContent += text;
              options.onToken({
                type: "token_stream",
                agentId: options.agentId,
                taskId: options.taskId,
                delta: text,
                isComplete: false,
                index: tokenIndex++,
                timestamp: Date.now(),
              });
            } else if (event.delta?.type === "input_json_delta") {
              const lastTool = currentToolCalls[currentToolCalls.length - 1];
              if (lastTool) {
                lastTool.inputJson += event.delta.partial_json;
              }
            }
          }
        } catch {
          // Ignore parse errors on stream events
        }
      }
    }

    options.onToken({
      type: "token_stream",
      agentId: options.agentId,
      taskId: options.taskId,
      delta: "",
      isComplete: true,
      index: tokenIndex,
      timestamp: Date.now(),
    });

    const parsedToolCalls: ToolCall[] = currentToolCalls.map((tc) => {
      let args = {};
      try {
        args = JSON.parse(tc.inputJson || "{}");
      } catch {
        args = {};
      }
      return {
        id: tc.id,
        name: tc.name,
        arguments: args,
      };
    });

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
