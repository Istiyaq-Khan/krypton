import {
  Message,
  ToolCall,
  McpTool,
  sanitizeBaseUrl,
  ProviderProtocol,
} from "@krypton/shared-types";
import {
  LLMProvider,
  ProtocolAdapter,
  GenerateOptions,
  GenerateResult,
  TokenUsage,
} from "../types.js";
import { BaseAdapter } from "./base.js";

export interface AnthropicAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Universal Anthropic-compatible protocol adapter.
 * Handles Claude 3.7 Sonnet, Claude 3.5 Haiku, Anthropic Vertex, and Claude API proxies.
 */
export class AnthropicProtocolAdapter extends BaseAdapter implements ProtocolAdapter {
  public readonly protocol: ProviderProtocol = "anthropic";

  public mapMessages(messages: Message[]): {
    systemPrompt: string;
    formattedMessages: Record<string, unknown>[];
  } {
    let systemPrompt = "";
    const formattedMessages: Record<string, unknown>[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt += (systemPrompt ? "\n\n" : "") + (msg.content || "");
        continue;
      }

      if (msg.role === "tool") {
        // Anthropic encodes tool results as user role with tool_result content blocks
        const toolResults = msg.toolResults || [];
        const contentBlocks = toolResults.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.toolCallId,
          content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content),
          is_error: Boolean(tr.isError),
        }));

        formattedMessages.push({
          role: "user",
          content: contentBlocks.length > 0 ? contentBlocks : msg.content || "",
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
            input: tc.arguments || {},
          });
        }
        formattedMessages.push({
          role: "assistant",
          content: contentBlocks,
        });
        continue;
      }

      formattedMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content || "",
      });
    }

    return { systemPrompt, formattedMessages };
  }

  public mapTools(tools?: McpTool[]): Record<string, unknown>[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema || { type: "object", properties: {} },
    }));
  }

  public async execute(
    model: string,
    options: GenerateOptions,
    clientConfig: {
      baseUrl: string;
      apiKey?: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    }
  ): Promise<GenerateResult> {
    const cleanBase = sanitizeBaseUrl(clientConfig.baseUrl || "https://api.anthropic.com/v1");
    const endpoint = cleanBase.endsWith("/messages")
      ? cleanBase
      : `${cleanBase}/messages`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      ...clientConfig.headers,
    };

    if (clientConfig.apiKey && clientConfig.apiKey.trim().length > 0) {
      headers["x-api-key"] = clientConfig.apiKey.trim();
    }

    const { systemPrompt, formattedMessages } = this.mapMessages(options.messages);
    const isStreaming = Boolean(options.onToken);

    const bodyPayload: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      stream: isStreaming,
    };

    if (systemPrompt.trim().length > 0) {
      bodyPayload.system = systemPrompt.trim();
    }

    const toolsPayload = this.mapTools(options.tools);
    if (toolsPayload && toolsPayload.length > 0) {
      bodyPayload.tools = toolsPayload;
    }

    const res = await this.fetchWithBackoff(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: options.abortSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic API request failed (${res.status} ${res.statusText}): ${errText}`);
    }

    const toolCallsMap = new Map<number, { id: string; name: string; argsStr: string }>();
    let accumulatedContent = "";
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    if (isStreaming) {
      accumulatedContent = await this.processSseStream({
        response: res,
        agentId: options.agentId,
        taskId: options.taskId,
        abortSignal: options.abortSignal,
        onToken: options.onToken,
        onChunk: (payload: any) => {
          if (!payload) return {};
          const type = payload.type;
          let delta = "";
          let isComplete = false;

          if (type === "content_block_delta") {
            if (payload.delta?.type === "text_delta") {
              delta = payload.delta.text || "";
            } else if (payload.delta?.type === "input_json_delta") {
              const idx = payload.index ?? 0;
              const existing = toolCallsMap.get(idx) || { id: `call_${idx}`, name: "", argsStr: "" };
              existing.argsStr += payload.delta.partial_json || "";
              toolCallsMap.set(idx, existing);
            }
          } else if (type === "content_block_start") {
            if (payload.content_block?.type === "tool_use") {
              const idx = payload.index ?? 0;
              toolCallsMap.set(idx, {
                id: payload.content_block.id || `call_${idx}`,
                name: payload.content_block.name || "",
                argsStr: "",
              });
            }
          } else if (type === "message_delta") {
            if (payload.usage?.output_tokens) {
              usage.completionTokens = payload.usage.output_tokens;
              usage.totalTokens = usage.promptTokens + usage.completionTokens;
            }
          } else if (type === "message_start") {
            if (payload.message?.usage?.input_tokens) {
              usage.promptTokens = payload.message.usage.input_tokens;
              usage.totalTokens = usage.promptTokens + usage.completionTokens;
            }
          } else if (type === "message_stop") {
            isComplete = true;
          }

          return { delta, isComplete };
        },
      });
    } else {
      const data: any = await res.json();
      if (Array.isArray(data.content)) {
        for (const block of data.content) {
          if (block.type === "text") {
            accumulatedContent += block.text || "";
          } else if (block.type === "tool_use") {
            const idx = toolCallsMap.size;
            toolCallsMap.set(idx, {
              id: block.id,
              name: block.name,
              argsStr: JSON.stringify(block.input || {}),
            });
          }
        }
      }

      if (data.usage) {
        usage = {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        };
      }
    }

    const finalToolCalls: ToolCall[] = [];
    for (const item of toolCallsMap.values()) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(item.argsStr || "{}");
      } catch {
        parsedArgs = { raw: item.argsStr };
      }
      finalToolCalls.push({
        id: item.id,
        name: item.name,
        arguments: parsedArgs,
      });
    }

    return {
      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: accumulatedContent,
        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        timestamp: Date.now(),
      },
      toolCalls: finalToolCalls,
      usage,
    };
  }
}

/**
 * Standard Anthropic Gateway implementation implementing LLMProvider.
 */
export class AnthropicGateway implements LLMProvider {
  public readonly providerId: string;
  public readonly model: string;
  public readonly protocol: ProviderProtocol = "anthropic";
  public readonly baseUrl: string;
  private readonly adapter: AnthropicProtocolAdapter;
  private readonly apiKey?: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: {
    model: string;
    providerId?: string;
    apiKey?: string;
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
  }) {
    this.providerId = options.providerId || "anthropic";
    this.model = options.model;
    this.baseUrl = sanitizeBaseUrl(options.baseUrl || "https://api.anthropic.com/v1");
    this.apiKey = options.apiKey;
    this.defaultHeaders = options.defaultHeaders || {};
    this.adapter = new AnthropicProtocolAdapter();
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    return this.adapter.execute(this.model, options, {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      headers: this.defaultHeaders,
    });
  }
}
