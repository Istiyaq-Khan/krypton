import {
  PROVIDER_CATALOG,
  findCatalogProvider,
  ProviderCatalogItem,
} from "@krypton/shared-types";

export { PROVIDER_CATALOG, findCatalogProvider, type ProviderCatalogItem };

export const DEFAULT_PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  perplexity: "https://api.perplexity.ai",
  xai: "https://api.x.ai/v1",
  cohere: "https://api.cohere.com/v2",
  cerebras: "https://api.cerebras.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  ollama: "http://localhost:11434/v1",
  vllm: "http://localhost:8000/v1",
  lmstudio: "http://localhost:1234/v1",
  sglang: "http://localhost:30000/v1",
  custom: "http://localhost:8000/v1",
};

/**
 * Returns the default base URL for a provider ID if known.
 */
export function getDefaultBaseUrl(providerId: string): string | undefined {
  const lower = providerId.toLowerCase().trim();
  if (DEFAULT_PROVIDER_URLS[lower]) {
    return DEFAULT_PROVIDER_URLS[lower];
  }
  const catalogItem = findCatalogProvider(lower);
  return catalogItem?.apiUrl;
}
