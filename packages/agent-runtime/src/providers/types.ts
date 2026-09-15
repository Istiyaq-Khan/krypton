import {
  Message,
  ToolCall,
  McpTool,
  TokenStreamChunk,
} from "@krypton/shared-types";

export interface GenerateOptions {
  agentId: string;
  taskId?: string;
  messages: Message[];
  tools?: McpTool[];
  temperature?: number;
  maxTokens?: number;
  abortSignal?: AbortSignal;
  onToken?: (chunk: TokenStreamChunk) => void;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateResult {
  message: Message;
  toolCalls: ToolCall[];
  usage: TokenUsage;
}

export interface LLMProvider {
  readonly providerId: string;
  readonly model: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
}
