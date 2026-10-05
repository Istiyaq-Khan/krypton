import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  ModelProviderId,
  DiscoveredModel,
  CachedModelsData,
  sanitizeBaseUrl,
  PROVIDER_CATALOG,
  CatalogProvider,
  findCatalogProvider,
  parseNamespacedModel,
  formatNamespacedModel,
  normalizeCredential,
  CredentialRef,
} from "@krypton/shared-types"

export {
  type ModelProviderId,
  type DiscoveredModel,
  type CachedModelsData,
  type CatalogProvider,
  type CredentialRef,
  PROVIDER_CATALOG,
  findCatalogProvider,
  parseNamespacedModel,
  formatNamespacedModel,
  normalizeCredential,
  sanitizeBaseUrl,
}

export interface ModelDiscoveryOptions {
  provider: ModelProviderId | string
  apiKey?: string
  baseUrl?: string
  useProxy?: boolean
}

export interface ModelDiscoveryResult {
  success: boolean
  provider: ModelProviderId | string
  models: DiscoveredModel[]
  error?: string
}

export interface ActiveProviderConfig {
  provider: string
  model: string
  baseUrl?: string
  apiKey?: string
  credential?: CredentialRef
}

export interface SaveProviderConfigInput {
  provider: string
  model: string
  baseUrl?: string
  apiKey?: string
  credential?: CredentialRef
}

export interface InferenceStreamOptions {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  maxTokens?: number
  onToken?: (token: string) => void
  onError?: (err: Error) => void
  onComplete?: () => void
  signal?: AbortSignal
}

/**
 * Evaluates whether a given model supports temperature parameterization.
 * Reasoning models (o1, o1-mini, o1-preview, o3, o3-mini, o4, or models explicitly flagged supportsTemperature: false)
 * do not support variable temperature tuning.
 */
export function isTemperatureSupported(
  modelId?: string,
  modelMeta?: Partial<DiscoveredModel> & { supports_temperature?: boolean }
): boolean {
  if (modelMeta) {
    if (typeof modelMeta.supportsTemperature === "boolean") {
      return modelMeta.supportsTemperature
    }
    if (typeof modelMeta.supports_temperature === "boolean") {
      return modelMeta.supports_temperature
    }
  }

  if (!modelId) return true

  const lower = modelId.toLowerCase().trim()
  if (
    lower === "o1" ||
    lower.startsWith("o1-") ||
    lower.startsWith("o1_") ||
    lower === "o3" ||
    lower.startsWith("o3-") ||
    lower.startsWith("o3_") ||
    lower.startsWith("o4-") ||
    lower.includes("reasoning")
  ) {
    return false
  }

  return true
}

export const DAEMON_PROXY_URL = "http://127.0.0.1:19840/api/fetch-models"

export const DEFAULT_PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "http://localhost:8000/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com",
  together: "https://api.together.xyz/v1",
}

export interface ProviderMetadataItem {
  name: string
  tagline: string
  requiresApiKey: boolean
  requiresBaseUrl: boolean
  defaultBaseUrl: string
  keyPlaceholder: string
  urlPlaceholder: string
  docsUrl?: string
  apiKeyUrl?: string
}

export const PROVIDER_METADATA: Record<string, ProviderMetadataItem> = {
  openai: {
    name: "OpenAI-Compatible",
    tagline: "OpenAI, NVIDIA NIM, vLLM, Ollama, OpenRouter, Groq",
    requiresApiKey: true,
    requiresBaseUrl: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-... or API Key",
    urlPlaceholder: "https://api.openai.com/v1, https://integrate.api.nvidia.com/v1, or http://localhost:11434/v1",
    docsUrl: "https://platform.openai.com/docs",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic-Compatible",
    tagline: "Claude 3.7 Sonnet, Claude 3.5 Haiku & Compatible Proxies",
    requiresApiKey: true,
    requiresBaseUrl: true,
    defaultBaseUrl: "https://api.anthropic.com/v1",
    keyPlaceholder: "sk-ant-api03-...",
    urlPlaceholder: "https://api.anthropic.com/v1",
    docsUrl: "https://docs.anthropic.com",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  ollama: {
    name: "Ollama / Local Runtime",
    tagline: "Offline local model server (Llama, DeepSeek, Qwen)",
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    keyPlaceholder: "Optional API Key",
    urlPlaceholder: "http://localhost:11434/v1 or http://localhost:11434",
    docsUrl: "https://ollama.com",
  },
  openrouter: {
    name: "OpenRouter",
    tagline: "Universal multi-provider gateway",
    requiresApiKey: true,
    requiresBaseUrl: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-v1-...",
    urlPlaceholder: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs",
    apiKeyUrl: "https://openrouter.ai/keys",
  },
  custom: {
    name: "Custom Compatible",
    tagline: "Custom OpenAI-compatible API (vLLM, LM Studio)",
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:8000/v1",
    keyPlaceholder: "Optional Bearer Token",
    urlPlaceholder: "http://localhost:8000/v1",
  },
}

/**
 * Resolves metadata for any provider ID, falling back to the 64-provider catalog.
 */
export function getProviderMetadata(providerId: string): ProviderMetadataItem {
  const lower = (providerId || "openai").toLowerCase().trim()
  if (PROVIDER_METADATA[lower]) {
    return PROVIDER_METADATA[lower]
  }

  const catalogItem = findCatalogProvider(lower)
  if (catalogItem) {
    return {
      name: catalogItem.name,
      tagline: `${catalogItem.name} endpoint (${catalogItem.protocol})`,
      requiresApiKey: !catalogItem.isLocal && !catalogItem.id.includes("ollama"),
      requiresBaseUrl: true,
      defaultBaseUrl: catalogItem.apiUrl,
      keyPlaceholder: catalogItem.isLocal ? "Optional API Key" : "API Key / Bearer Token",
      urlPlaceholder: catalogItem.apiUrl,
      docsUrl: catalogItem.docs,
      apiKeyUrl: catalogItem.apiKeyUrl,
    }
  }

  return {
    name: providerId,
    tagline: "Custom Model Provider",
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:8000/v1",
    keyPlaceholder: "Optional Bearer Token",
    urlPlaceholder: "http://localhost:8000/v1",
  }
}

/**
 * Executes dynamic model discovery against the provider's standard endpoint,
 * validating credentials and returning detailed error diagnostics on failure.
 * When in Tauri desktop mode, queries the backend daemon to bypass renderer CORS restrictions.
 */
export async function testAndFetchModels(
  options: ModelDiscoveryOptions
): Promise<ModelDiscoveryResult> {
  const provider = options.provider as ModelProviderId
  const apiKey = (options.apiKey || "").trim()
  const rawBaseUrl = sanitizeBaseUrl(options.baseUrl || "")
  const lowerProvider = String(provider || "openai").toLowerCase().trim()
  const catalogItem = findCatalogProvider(lowerProvider)
  const isAnthropic = catalogItem ? catalogItem.protocol === "anthropic" : lowerProvider.includes("anthropic")

  // 1. Validate required inputs
  if (lowerProvider === "openai" && !apiKey && (!rawBaseUrl || rawBaseUrl.includes("api.openai.com"))) {
    return {
      success: false,
      provider,
      models: [],
      error: "OpenAI requires an API key (sk-proj-...).",
    }
  }

  if (isAnthropic && !apiKey && !catalogItem?.isLocal) {
    return {
      success: false,
      provider,
      models: [],
      error: "Anthropic requires an API key (sk-ant-api03-...).",
    }
  }

  if (lowerProvider === "openrouter" && !apiKey) {
    return {
      success: false,
      provider,
      models: [],
      error: "OpenRouter requires an API key (sk-or-v1-...).",
    }
  }

  if ((lowerProvider === "ollama" || lowerProvider === "custom") && !rawBaseUrl) {
    return {
      success: false,
      provider,
      models: [],
      error: `Please provide a valid Base URL for ${getProviderMetadata(lowerProvider).name}.`,
    }
  }

  const inTauri = typeof window !== "undefined" && isTauri()
  const shouldProxy = options.useProxy ?? inTauri

  // 2. If proxy requested or running in Tauri desktop, dispatch to backend daemon to bypass renderer CORS
  if (shouldProxy) {
    const callProxy = async (): Promise<ModelDiscoveryResult> => {
      const proxyRes = await fetch(DAEMON_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl: rawBaseUrl,
        }),
      })

      if (proxyRes.ok) {
        return (await proxyRes.json()) as ModelDiscoveryResult
      } else {
        const errJson = await proxyRes.json().catch(() => null)
        return {
          success: false,
          provider,
          models: [],
          error: errJson?.error || `Daemon returned HTTP ${proxyRes.status}`,
        }
      }
    }

    try {
      return await callProxy()
    } catch {
      // In Tauri desktop mode, if daemon is not answering, auto-spawn and retry once
      if (inTauri) {
        try {
          await invoke("spawn_daemon")
          await new Promise((resolve) => setTimeout(resolve, 600))
          return await callProxy()
        } catch {
          return {
            success: false,
            provider,
            models: [],
            error: "Krypton background daemon is starting up or unreachable at 127.0.0.1:19840. Please wait a moment and try again.",
          }
        }
      }

      // If proxy was explicitly requested, never fall through to direct remote fetch to avoid browser CORS errors
      if (options.useProxy) {
        return {
          success: false,
          provider,
          models: [],
          error: "Krypton background daemon is unreachable at 127.0.0.1:19840. Remote operations must execute via native backend daemon to prevent browser CORS restrictions.",
        }
      }
      // If not in Tauri and proxy was not explicitly requested (e.g. offline unit test mocking globalThis.fetch), fall through to mockable direct fetch
    }
  }

  const effectiveBaseUrl = (
    rawBaseUrl ||
    catalogItem?.apiUrl ||
    DEFAULT_PROVIDER_URLS[lowerProvider] ||
    "https://api.openai.com/v1"
  ).replace(/\/+$/, "")

  // 3. Build target request configuration
  let targetUrl = ""
  const headers: Record<string, string> = {
    Accept: "application/json",
  }

  if (isAnthropic) {
    targetUrl = effectiveBaseUrl.endsWith("/models")
      ? effectiveBaseUrl
      : `${effectiveBaseUrl}/models`
    if (apiKey) {
      headers["x-api-key"] = apiKey
    }
    headers["anthropic-version"] = "2023-06-01"
    headers["anthropic-dangerous-direct-browser-access"] = "true"
  } else if (lowerProvider === "openrouter") {
    targetUrl = effectiveBaseUrl.endsWith("/v1")
      ? `${effectiveBaseUrl}/models`
      : `${effectiveBaseUrl}/v1/models`
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }
    headers["HTTP-Referer"] = "https://krypton.local"
    headers["X-Title"] = "Krypton Desktop"
  } else {
    // OpenAI-compatible and custom endpoints
    targetUrl = effectiveBaseUrl.endsWith("/models")
      ? effectiveBaseUrl
      : effectiveBaseUrl.endsWith("/v1")
      ? `${effectiveBaseUrl}/models`
      : `${effectiveBaseUrl}/v1/models`
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }
  }

  // 4. Dispatch fetch with 10-second timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    let res = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    })

    // If Ollama /v1/models returns 404, fallback to /api/tags
    if (!res.ok && res.status === 404 && lowerProvider === "ollama") {
      const fallbackUrl = `${effectiveBaseUrl}/api/tags`
      try {
        const fallbackRes = await fetch(fallbackUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        })
        if (fallbackRes.ok) {
          res = fallbackRes
        }
      } catch {
        // preserve original response
      }
    }

    clearTimeout(timeoutId)

    if (!res.ok) {
      const status = res.status
      let errorDetail = ""
      try {
        const errorJson = await res.json()
        errorDetail =
          errorJson.error?.message ||
          errorJson.message ||
          (typeof errorJson.error === "string" ? errorJson.error : "")
      } catch {
        errorDetail = await res.text().catch(() => "")
      }

      const provName = getProviderMetadata(lowerProvider).name

      if (status === 401) {
        return {
          success: false,
          provider,
          models: [],
          error: `Authentication failed (401): The provided API key was rejected by ${provName}. ${errorDetail}`.trim(),
        }
      }

      if (status === 403) {
        return {
          success: false,
          provider,
          models: [],
          error: `Access denied (403): The API key lacks permission to list models. ${errorDetail}`.trim(),
        }
      }

      if (status === 404) {
        return {
          success: false,
          provider,
          models: [],
          error: `Endpoint not found (404): Could not find models route at ${targetUrl}. Verify your Base URL.`,
        }
      }

      if (status === 429) {
        return {
          success: false,
          provider,
          models: [],
          error: `Rate limit / Quota exceeded (429): Account has exceeded quota or hit rate limits. ${errorDetail}`.trim(),
        }
      }

      if (status >= 500 && status <= 504) {
        return {
          success: false,
          provider,
          models: [],
          error: `Upstream server error (${status}): Service at ${effectiveBaseUrl} returned a server error. ${errorDetail}`.trim(),
        }
      }

      return {
        success: false,
        provider,
        models: [],
        error: `Provider error (${status}): ${errorDetail || res.statusText || "Request failed"}`,
      }
    }

    const data = await res.json()
    const parsedModels: DiscoveredModel[] = []

    if (Array.isArray(data.data)) {
      // Standard OpenAI / OpenRouter / Anthropic format
      for (const item of data.data) {
        if (item && item.id) {
          const modelId = String(item.id)
          parsedModels.push({
            id: modelId,
            name: item.display_name || item.name || modelId,
            description: item.description,
            contextLength: item.context_length,
            created: item.created,
            ownedBy: item.owned_by,
            supportsTemperature: isTemperatureSupported(modelId, item),
          })
        }
      }
    } else if (Array.isArray(data.models)) {
      // Ollama /api/tags format
      for (const item of data.models) {
        const modelId = item.name || item.model
        if (modelId) {
          const mId = String(modelId)
          parsedModels.push({
            id: mId,
            name: mId,
            description: item.details?.family ? `Family: ${item.details.family}` : undefined,
            supportsTemperature: isTemperatureSupported(mId, item),
          })
        }
      }
    }

    if (parsedModels.length === 0) {
      if (lowerProvider === "ollama") {
        return {
          success: false,
          provider,
          models: [],
          error: `Connected to Ollama at ${effectiveBaseUrl}, but no local models are installed. Run 'ollama pull <model>' in terminal.`,
        }
      }

      return {
        success: false,
        provider,
        models: [],
        error: `Connected to ${getProviderMetadata(lowerProvider).name}, but no models were returned by the endpoint.`,
      }
    }

    // Sort models cleanly: alphabetical
    parsedModels.sort((a, b) => a.id.localeCompare(b.id))

    return {
      success: true,
      provider,
      models: parsedModels,
    }
  } catch (err: any) {
    clearTimeout(timeoutId)

    if (err.name === "AbortError") {
      return {
        success: false,
        provider,
        models: [],
        error: `Request timed out after 10 seconds while connecting to ${effectiveBaseUrl}. Check server status and network.`,
      }
    }

    const errMsg = String(err?.message || err)
    if (
      errMsg.includes("Failed to fetch") ||
      errMsg.includes("fetch failed") ||
      errMsg.includes("ECONNREFUSED") ||
      errMsg.includes("NetworkError")
    ) {
      if (lowerProvider === "ollama") {
        return {
          success: false,
          provider,
          models: [],
          error: `Connection refused: Unable to connect to Ollama at ${effectiveBaseUrl}. Ensure the Ollama service is running ('ollama serve').`,
        }
      }

      return {
        success: false,
        provider,
        models: [],
        error: `Network/CORS error: Unable to connect to ${effectiveBaseUrl}. Check your internet connection or server CORS headers.`,
      }
    }

    return {
      success: false,
      provider,
      models: [],
      error: `Failed to fetch models from ${getProviderMetadata(lowerProvider).name}: ${errMsg}`,
    }
  }
}

/**
 * Saves provider configuration securely across Tauri backend, daemon proxy, and local fallback.
 */
export async function saveProviderConfig(config: SaveProviderConfigInput): Promise<boolean> {
  const inTauri = typeof window !== "undefined" && isTauri()

  if (inTauri) {
    try {
      await invoke("save_setup_configuration", {
        payload: {
          agentName: "Orchestrator",
          provider: config.provider,
          primaryModel: config.model,
          apiKeys: {
            provider: config.provider,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            customEndpoint: config.baseUrl,
            customModel: config.model,
          },
        },
      })
      return true
    } catch (err) {
      console.warn("Could not save provider config via Tauri invoke, trying daemon:", err)
    }
  }

  try {
    const res = await fetch("http://127.0.0.1:19840/api/save-provider-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    if (res.ok) return true
  } catch {
    // Daemon offline
  }

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("krypton_provider_config", JSON.stringify(config))
  }

  return true
}

/**
 * Executes a streaming inference request proxied via the native backend daemon.
 */
export async function executeInferenceStream(
  options: InferenceStreamOptions
): Promise<void> {
  const { model, messages, temperature, maxTokens, onToken, onError, onComplete, signal } = options
  try {
    const res = await fetch("http://127.0.0.1:19840/api/execute-inference-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, maxTokens }),
      signal,
    })

    if (!res.ok) {
      throw new Error(`Inference stream request failed with status ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) {
      throw new Error("No readable stream received from daemon")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith("data: ")) {
          const raw = trimmed.slice(6)
          if (raw === "[DONE]") {
            onComplete?.()
            return
          }
          try {
            const parsed = JSON.parse(raw)
            const token = parsed.token || parsed.delta?.content || ""
            if (token) onToken?.(token)
          } catch {
            if (raw) onToken?.(raw)
          }
        }
      }
    }
    onComplete?.()
  } catch (err: any) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
  }
}

let inMemoryCachedModels: CachedModelsData | null = null

/**
 * Loads cached models from ~/.krypton/models_cache.json via Tauri IPC,
 * with localStorage and in-memory fallbacks.
 */
export async function loadCachedModels(): Promise<CachedModelsData | null> {
  if (typeof window !== "undefined" && isTauri()) {
    try {
      const res = await invoke<CachedModelsData>("get_cached_models")
      if (res && res.models && res.models.length > 0) {
        return res
      }
    } catch (err) {
      console.warn("Could not read cached models from Tauri IPC:", err)
    }
  }

  // Fallback to localStorage (window or globalThis)
  const storage =
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof globalThis !== "undefined" && globalThis.localStorage
      ? globalThis.localStorage
      : null

  if (storage) {
    try {
      const raw = storage.getItem("krypton_cached_models")
      if (raw) {
        return JSON.parse(raw) as CachedModelsData
      }
    } catch {
      // ignore
    }
  }

  return inMemoryCachedModels
}

/**
 * Persists discovered models to local cache (~/.krypton/models_cache.json, localStorage, and in-memory).
 */
export async function persistCachedModels(data: CachedModelsData): Promise<void> {
  inMemoryCachedModels = data

  const storage =
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof globalThis !== "undefined" && globalThis.localStorage
      ? globalThis.localStorage
      : null

  if (storage) {
    try {
      storage.setItem("krypton_cached_models", JSON.stringify(data))
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined" && isTauri()) {
    try {
      await invoke("save_cached_models", { payload: data })
    } catch (err) {
      console.warn("Could not save cached models to Tauri IPC:", err)
    }
  }
}

/**
 * Retrieves active provider configuration for in-app refresh.
 */
export async function getActiveProviderConfig(): Promise<ActiveProviderConfig | null> {
  if (typeof window !== "undefined" && isTauri()) {
    try {
      const res = await invoke<ActiveProviderConfig>("get_provider_config")
      if (res && res.provider) {
        return res
      }
    } catch (err) {
      console.warn("Could not read provider config from Tauri IPC:", err)
    }
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("krypton_provider_config")
      if (raw) {
        return JSON.parse(raw) as ActiveProviderConfig
      }
    } catch {
      // ignore
    }
  }

  return null
}
