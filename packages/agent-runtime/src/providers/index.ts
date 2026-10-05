import { LLMProvider, CreateProviderOptions } from "./types.js";
import { getProviderRegistry, resolveApiKey } from "./registry.js";

export * from "./types.js";
export * from "./vault.js";
export * from "./registry.js";
export * from "./fallback.js";
export * from "./catalog.js";
export * from "./adapters/base.js";
export * from "./adapters/openai.js";
export * from "./adapters/anthropic.js";
export * from "./adapters/custom.js";

/**
 * Factory router creating LLMProvider instances based on agent configuration.
 * Fully supports namespaced model strings (<provider_id>/<model_id>) and fallback chains.
 */
export async function createModelProvider(
  options: CreateProviderOptions
): Promise<LLMProvider> {
  const registry = getProviderRegistry();
  return registry.createProvider(options);
}
