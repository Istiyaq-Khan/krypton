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

export interface OpenAiAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Universal OpenAI-compatible protocol adapter.
 * Supports OpenAI, NVIDIA NIM, DeepSeek, Groq, Mistral, Together, Fireworks, OpenRouter, vLLM, Ollama, etc.
 */
export class OpenAiProtocolAdapter extends BaseAdapter implements ProtocolAdapter {
  public readonly protocol: ProviderProtocol = "openai";

  public mapMessages(messages: Message[]): Record<string, unknown>[] {
    return messages.map((msg) => {
      const formatted: Record<string, unknown> = {
        role: msg.role,
        content: msg.content || "",
      };

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formatted.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments || {}),
          },
        }));
      }

      if (msg.role === "tool" && msg.toolResults && msg.toolResults[0]) {
        formatted.tool_call_id = msg.toolResults[0].toolCallId;
      }

      return formatted;
    });
  }

  public mapTools(tools?: McpTool[]): Record<string, unknown>[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema || { type: "object", properties: {} },
      },
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
    const cleanBase = sanitizeBaseUrl(clientConfig.baseUrl || "https://api.openai.com/v1");
    const endpoint = cleanBase.endsWith("/chat/completions")
      ? cleanBase
      : `${cleanBase}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...clientConfig.headers,
    };

    if (clientConfig.apiKey && clientConfig.apiKey.trim().length > 0) {
      headers["Authorization"] = `Bearer ${clientConfig.apiKey.trim()}`;
    }

    const isStreaming = Boolean(options.onToken);
    const bodyPayload: Record<string, unknown> = {
      model,
      messages: this.mapMessages(options.messages),
      temperature: options.temperature ?? 0.7,
      stream: isStreaming,
    };

    if (options.maxTokens) {
      bodyPayload.max_tokens = options.maxTokens;
    }

    const toolsPayload = this.mapTools(options.tools);
    if (toolsPayload && toolsPayload.length > 0) {
      bodyPayload.tools = toolsPayload;
      bodyPayload.tool_choice = "auto";
    }

    const res = await this.fetchWithBackoff(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: options.abortSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI-compatible request failed (${res.status} ${res.statusText}): ${errText}`);
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
          const choice = payload.choices?.[0];
          const delta = choice?.delta?.content || "";
          const isComplete = choice?.finish_reason !== null && choice?.finish_reason !== undefined;

          // Accumulate tool call fragments if present
          if (choice?.delta?.tool_calls && Array.isArray(choice.delta.tool_calls)) {
            for (const tc of choice.delta.tool_calls) {
              const idx = tc.index ?? 0;
              const existing = toolCallsMap.get(idx) || { id: tc.id || `call_${idx}`, name: "", argsStr: "" };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.argsStr += tc.function.arguments;
              toolCallsMap.set(idx, existing);
            }
          }

          if (payload.usage) {
            usage = {
              promptTokens: payload.usage.prompt_tokens || 0,
              completionTokens: payload.usage.completion_tokens || 0,
              totalTokens: payload.usage.total_tokens || 0,
            };
          }

          return { delta, isComplete };
        },
      });
    } else {
      const data: any = await res.json();
      const choice = data.choices?.[0];
      accumulatedContent = choice?.message?.content || "";

      if (choice?.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
        choice.message.tool_calls.forEach((tc: any, idx: number) => {
          toolCallsMap.set(idx, {
            id: tc.id || `call_${idx}`,
            name: tc.function?.name || "",
            argsStr: tc.function?.arguments || "{}",
          });
        });
      }

      if (data.usage) {
        usage = {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
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
 * Standard OpenAI Gateway implementation implementing LLMProvider.
 */
export class OpenAiGateway implements LLMProvider {
  public readonly providerId: string;
  public readonly model: string;
  public readonly protocol: ProviderProtocol = "openai";
  public readonly baseUrl: string;
  private readonly adapter: OpenAiProtocolAdapter;
  private readonly apiKey?: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: {
    model: string;
    providerId?: string;
    apiKey?: string;
    baseUrl?: string;
    defaultHeaders?: Record<string, string>;
  }) {
    this.providerId = options.providerId || "openai";
    this.model = options.model;
    this.baseUrl = sanitizeBaseUrl(options.baseUrl || "https://api.openai.com/v1");
    this.apiKey = options.apiKey;
    this.defaultHeaders = options.defaultHeaders || {};
    this.adapter = new OpenAiProtocolAdapter();
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    return this.adapter.execute(this.model, options, {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      headers: this.defaultHeaders,
    });
  }
}
