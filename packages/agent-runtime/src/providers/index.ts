import { LLMProvider } from "./types.js";
import { OpenAiGateway } from "./openai.js";
import { AnthropicGateway } from "./anthropic.js";
import { SecretVault } from "./vault.js";

export * from "./types.js";
export * from "./vault.js";
export * from "./openai.js";
export * from "./anthropic.js";

export interface CreateProviderOptions {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  vault?: SecretVault;
}

const DEFAULT_PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  ollama: "http://localhost:11434/v1",
  anthropic: "https://api.anthropic.com/v1",
};

/**
 * Resolves an API key from explicit option, vault, or process environment.
 */
export async function resolveApiKey(
  provider: string,
  explicitKey?: string,
  vault?: SecretVault
): Promise<string> {
  if (explicitKey) return explicitKey;

  const normalized = provider.toLowerCase();

  // 1. Vault lookup
  if (vault) {
    const vaultKey = await vault.getSecret(`${normalized}_api_key`);
    if (vaultKey) return vaultKey;
    const genericKey = await vault.getSecret("api_key");
    if (genericKey) return genericKey;
  }

  // 2. Env var lookup
  const envMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    groq: process.env.GROQ_API_KEY,
  };

  const envKey = envMap[normalized];
  if (envKey) return envKey;

  // Ollama doesn't require an actual API key
  if (normalized === "ollama") {
    return "ollama";
  }

  return "";
}

/**
 * Factory router creating LLMProvider instances based on agent configuration.
 */
export async function createModelProvider(
  options: CreateProviderOptions
): Promise<LLMProvider> {
  const provider = options.provider.toLowerCase();
  const apiKey = await resolveApiKey(provider, options.apiKey, options.vault);
  const baseUrl = options.baseUrl || DEFAULT_PROVIDER_URLS[provider];

  if (provider === "anthropic") {
    return new AnthropicGateway({
      apiKey,
      model: options.model,
      baseUrl,
    });
  }

  // OpenAI, DeepSeek, Groq, vLLM, Ollama all use the OpenAI-compatible gateway
  return new OpenAiGateway({
    apiKey,
    model: options.model,
    baseUrl,
  });
}
