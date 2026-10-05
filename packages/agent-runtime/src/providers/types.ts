import {
  Message,
  ToolCall,
  McpTool,
  TokenStreamChunk,
  ProviderProtocol,
  ModelCredential,
} from "@krypton/shared-types";
import { SecretVault } from "./vault.js";

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

/**
 * Agnostic core LLM Provider contract.
 * The core agent runtime interacts strictly through this interface without knowledge of provider quirks.
 */
export interface LLMProvider {
  readonly providerId: string;
  readonly model: string;
  readonly protocol?: ProviderProtocol;
  readonly baseUrl?: string;
  generate(options: GenerateOptions): Promise<GenerateResult>;
}

/**
 * Protocol adapter interface for external model wire format translation.
 */
export interface ProtocolAdapter {
  readonly protocol: ProviderProtocol;
  execute(
    model: string,
    options: GenerateOptions,
    clientConfig: {
      baseUrl: string;
      apiKey?: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    }
  ): Promise<GenerateResult>;
}

export interface CreateProviderOptions {
  provider?: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  credential?: ModelCredential;
  vault?: SecretVault;
  headers?: Record<string, string>;
  fallbackChain?: string[];
}
