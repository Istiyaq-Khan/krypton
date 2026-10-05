import {
  parseNamespacedModel,
  formatNamespacedModel,
  ProviderProtocol,
  ProviderConfig,
  findCatalogProvider,
} from "@krypton/shared-types";
import { LLMProvider, CreateProviderOptions } from "./types.js";
import { OpenAiGateway } from "./adapters/openai.js";
import { AnthropicGateway } from "./adapters/anthropic.js";
import { CustomGateway } from "./adapters/custom.js";
import { FallbackProvider } from "./fallback.js";
import { getDefaultBaseUrl } from "./catalog.js";
import { SecretVault } from "./vault.js";

/**
 * Resolves an API key from explicit option, credential object, vault, or process environment.
 */
export async function resolveApiKey(
  provider: string,
  explicitKey?: string,
  vault?: SecretVault
): Promise<string> {
  if (explicitKey && explicitKey.trim().length > 0) {
    return explicitKey.trim();
  }

  const normalized = provider.toLowerCase().trim();

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
    mistral: process.env.MISTRAL_API_KEY,
    together: process.env.TOGETHER_API_KEY,
    fireworks: process.env.FIREWORKS_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
    xai: process.env.XAI_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    cerebras: process.env.CEREBRAS_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
    google: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  };

  const envKey = envMap[normalized];
  if (envKey) return envKey;

  // Local runtimes don't require an actual cloud API key
  if (normalized === "ollama" || normalized === "vllm" || normalized === "lmstudio" || normalized === "sglang") {
    return normalized;
  }

  return "";
}

/**
 * Pluggable registry of AI model providers, custom endpoints, and protocol adapters.
 */
export class ProviderRegistry {
  private readonly customProviders = new Map<string, ProviderConfig>();

  /**
   * Registers a custom or override provider configuration.
   */
  public registerProvider(config: ProviderConfig): void {
    this.customProviders.set(config.id.toLowerCase().trim(), config);
  }

  /**
   * Removes a custom provider configuration.
   */
  public unregisterProvider(id: string): boolean {
    return this.customProviders.delete(id.toLowerCase().trim());
  }

  /**
   * Retrieves registered provider config or catalog item.
   */
  public getProviderInfo(providerId: string): {
    id: string;
    protocol: ProviderProtocol;
    baseUrl: string;
    isLocal: boolean;
  } {
    const id = providerId.toLowerCase().trim();
    const custom = this.customProviders.get(id);
    if (custom) {
      return {
        id: custom.id,
        protocol: custom.protocol,
        baseUrl: custom.baseUrl,
        isLocal: Boolean(custom.isLocal),
      };
    }

    const catalogItem = findCatalogProvider(id);
    if (catalogItem) {
      return {
        id: catalogItem.id,
        protocol: catalogItem.protocol,
        baseUrl: catalogItem.apiUrl,
        isLocal: catalogItem.isLocal,
      };
    }

    // Default to OpenAI protocol
    return {
      id,
      protocol: id.includes("anthropic") ? "anthropic" : "openai",
      baseUrl: getDefaultBaseUrl(id) || "https://api.openai.com/v1",
      isLocal: id === "ollama" || id === "vllm" || id === "lmstudio" || id === "custom",
    };
  }

  /**
   * Creates an LLMProvider instance, parsing namespaced models (<provider>/<model>)
   * and optionally wrapping with FallbackProvider if fallback models are configured.
   */
  public async createProvider(options: CreateProviderOptions): Promise<LLMProvider> {
    const parsed = parseNamespacedModel(options.model, options.provider);
    const providerId = (options.provider || parsed.providerId).toLowerCase().trim();
    const targetModel = parsed.modelId;

    const info = this.getProviderInfo(providerId);
    const baseUrl = options.baseUrl || info.baseUrl;
    const apiKey = await resolveApiKey(providerId, options.apiKey, options.vault);

    let primaryProvider: LLMProvider;

    if (info.protocol === "anthropic") {
      primaryProvider = new AnthropicGateway({
        providerId,
        model: targetModel,
        baseUrl,
        apiKey,
        defaultHeaders: options.headers,
      });
    } else if (info.protocol === "custom" || info.isLocal) {
      primaryProvider = new CustomGateway({
        providerId,
        model: targetModel,
        baseUrl,
        apiKey,
        defaultHeaders: options.headers,
      });
    } else {
      primaryProvider = new OpenAiGateway({
        providerId,
        model: targetModel,
        baseUrl,
        apiKey,
        defaultHeaders: options.headers,
      });
    }

    // If fallback model chain is specified, instantiate fallbacks and wrap
    if (options.fallbackChain && options.fallbackChain.length > 0) {
      const fallbackProviders: LLMProvider[] = [];
      for (const fallbackModelStr of options.fallbackChain) {
        if (!fallbackModelStr || fallbackModelStr.trim() === options.model.trim()) continue;
        try {
          const fallbackInstance = await this.createProvider({
            model: fallbackModelStr.trim(),
            vault: options.vault,
            headers: options.headers,
          });
          fallbackProviders.push(fallbackInstance);
        } catch {
          // Ignore invalid fallback configuration
        }
      }

      if (fallbackProviders.length > 0) {
        return new FallbackProvider({
          primary: primaryProvider,
          fallbacks: fallbackProviders,
        });
      }
    }

    return primaryProvider;
  }
}

// Global registry singleton instance
let defaultRegistry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ProviderRegistry();
  }
  return defaultRegistry;
}
