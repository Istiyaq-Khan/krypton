import { DiscoveredModel } from "@krypton/shared-types"

export interface ProxyFetchModelsOptions {
  provider: string
  apiKey?: string
  baseUrl?: string
  timeoutMs?: number
}

export interface ProxyFetchModelsResult {
  success: boolean
  provider: string
  models: DiscoveredModel[]
  error?: string
}

export const DEFAULT_PROXY_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  "openai-compatible": "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  "anthropic-compatible": "https://api.anthropic.com/v1",
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "https://api.openai.com/v1",
}

/**
 * Resolves standard target endpoint URL for model discovery.
 */
export function resolveTargetModelsUrl(provider: string, baseUrl: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "")
  const isAnthropic = provider.toLowerCase().includes("anthropic")

  if (cleanBase.endsWith("/models")) {
    return cleanBase
  }

  if (isAnthropic) {
    return `${cleanBase}/models`
  }

  // OpenAI-compatible endpoints
  if (cleanBase.endsWith("/v1")) {
    return `${cleanBase}/models`
  }

  // If no /v1 or /models specified, default to /v1/models (or /models if already a custom API root)
  return `${cleanBase}/models`
}

/**
 * Backend model proxy handler executing in Node.js runtime.
 * Bypasses renderer browser CORS restrictions and resolves TLS/DNS natively.
 */
export async function proxyFetchModels(
  options: ProxyFetchModelsOptions
): Promise<ProxyFetchModelsResult> {
  const rawProvider = (options.provider || "openai").trim().toLowerCase()
  const apiKey = (options.apiKey || "").trim()
  const rawBaseUrl = (options.baseUrl || "").trim()
  const timeoutMs = options.timeoutMs || 10000

  const isAnthropic = rawProvider.includes("anthropic")
  const providerKey = isAnthropic ? "anthropic" : "openai"
  const providerDisplayName = isAnthropic ? "Anthropic-Compatible" : "OpenAI-Compatible"

  // 1. Validate required inputs
  if (isAnthropic && !apiKey) {
    return {
      success: false,
      provider: providerKey,
      models: [],
      error: "Anthropic-Compatible requires an API key (sk-ant-api03-...).",
    }
  }

  const effectiveBaseUrl = (rawBaseUrl || DEFAULT_PROXY_URLS[rawProvider] || DEFAULT_PROXY_URLS[providerKey]).replace(/\/+$/, "")

  // OpenAI direct cloud endpoint requires an API key; local/custom endpoints may not
  if (
    !isAnthropic &&
    effectiveBaseUrl.includes("api.openai.com") &&
    !apiKey
  ) {
    return {
      success: false,
      provider: providerKey,
      models: [],
      error: "OpenAI requires an API key (sk-proj-...).",
    }
  }

  // 2. Build target request configuration
  const targetUrl = resolveTargetModelsUrl(rawProvider, effectiveBaseUrl)
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Krypton-Daemon/1.0",
  }

  if (isAnthropic) {
    if (apiKey) {
      headers["x-api-key"] = apiKey
    }
    headers["anthropic-version"] = "2023-06-01"
    headers["anthropic-dangerous-direct-browser-access"] = "true"
  } else {
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }
    // Set OpenRouter headers if targeting OpenRouter
    if (effectiveBaseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://krypton.local"
      headers["X-Title"] = "Krypton Desktop"
    }
  }

  // 3. Dispatch native Node fetch with AbortController timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    let res = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    })

    // Handle Ollama fallback if /models or /v1/models returns 404
    if (!res.ok && res.status === 404 && (rawProvider === "ollama" || effectiveBaseUrl.includes("11434"))) {
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

    // 4. Map upstream HTTP status codes to user-friendly error banners
    if (!res.ok) {
      const status = res.status
      let errorDetail = ""
      try {
        const errorJson: any = await res.json()
        errorDetail =
          errorJson.error?.message ||
          errorJson.message ||
          (typeof errorJson.error === "string" ? errorJson.error : "")
      } catch {
        errorDetail = await res.text().catch(() => "")
      }

      if (status === 401) {
        return {
          success: false,
          provider: providerKey,
          models: [],
          error: `Authentication failed (401): The provided API key was rejected by ${providerDisplayName}. ${errorDetail}`.trim(),
        }
      }

      if (status === 403) {
        return {
          success: false,
          provider: providerKey,
          models: [],
          error: `Access denied (403): The API key lacks permission to list models. ${errorDetail}`.trim(),
        }
      }

      if (status === 404) {
        return {
          success: false,
          provider: providerKey,
          models: [],
          error: `Endpoint not found (404): Could not find models route at ${targetUrl}. Verify your Base URL.`,
        }
      }

      if (status === 429) {
        return {
          success: false,
          provider: providerKey,
          models: [],
          error: `Rate limit / Quota exceeded (429): Account has exceeded quota or hit rate limits. ${errorDetail}`.trim(),
        }
      }

      if (status >= 500 && status <= 504) {
        return {
          success: false,
          provider: providerKey,
          models: [],
          error: `Upstream server error (${status}): Service at ${effectiveBaseUrl} returned a server error. ${errorDetail}`.trim(),
        }
      }

      return {
        success: false,
        provider: providerKey,
        models: [],
        error: `Provider error (${status}): ${errorDetail || res.statusText || "Request failed"}`,
      }
    }

    // 5. Parse discovered models roster
    const data: any = await res.json()
    const parsedModels: DiscoveredModel[] = []

    if (data && Array.isArray(data.data)) {
      // Standard OpenAI / OpenRouter / Anthropic format
      for (const item of data.data) {
        if (item && item.id) {
          parsedModels.push({
            id: String(item.id),
            name: item.display_name || item.name || String(item.id),
            description: item.description,
            contextLength: item.context_length || item.max_tokens,
            created: typeof item.created === "number" ? item.created : undefined,
            ownedBy: item.owned_by ? String(item.owned_by) : undefined,
          })
        }
      }
    } else if (data && Array.isArray(data.models)) {
      // Ollama /api/tags format
      for (const item of data.models) {
        const modelId = item.name || item.model
        if (modelId) {
          parsedModels.push({
            id: String(modelId),
            name: String(modelId),
            description: item.details?.family ? `Family: ${item.details.family}` : undefined,
          })
        }
      }
    } else if (Array.isArray(data)) {
      // Top-level array format
      for (const item of data) {
        if (typeof item === "string") {
          parsedModels.push({ id: item, name: item })
        } else if (item && typeof item === "object" && item.id) {
          parsedModels.push({
            id: String(item.id),
            name: item.name || String(item.id),
            description: item.description,
          })
        }
      }
    }

    if (parsedModels.length === 0) {
      return {
        success: false,
        provider: providerKey,
        models: [],
        error: `Connected to ${providerDisplayName} at ${effectiveBaseUrl}, but no models were returned by the endpoint roster.`,
      }
    }

    // Sort alphabetically by ID
    parsedModels.sort((a, b) => a.id.localeCompare(b.id))

    return {
      success: true,
      provider: providerKey,
      models: parsedModels,
    }
  } catch (err: any) {
    clearTimeout(timeoutId)

    if (err.name === "AbortError" || err.message?.includes("aborted")) {
      return {
        success: false,
        provider: providerKey,
        models: [],
        error: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds while connecting to ${effectiveBaseUrl}. Check server status and network.`,
      }
    }

    const errMsg = String(err?.message || err)
    if (errMsg.includes("ECONNREFUSED")) {
      return {
        success: false,
        provider: providerKey,
        models: [],
        error: `Connection refused: Unable to connect to server at ${effectiveBaseUrl}. Ensure the model service is running.`,
      }
    }

    if (errMsg.includes("ENOTFOUND")) {
      return {
        success: false,
        provider: providerKey,
        models: [],
        error: `Host not found (DNS resolution failed): Unable to reach host for ${effectiveBaseUrl}. Verify the Base URL domain.`,
      }
    }

    if (
      errMsg.includes("Failed to fetch") ||
      errMsg.includes("fetch failed") ||
      errMsg.includes("NetworkError")
    ) {
      return {
        success: false,
        provider: providerKey,
        models: [],
        error: `Network/CORS error: Unable to connect to ${effectiveBaseUrl}. Check your internet connection or server headers.`,
      }
    }

    return {
      success: false,
      provider: providerKey,
      models: [],
      error: `Failed to fetch models from ${providerDisplayName}: ${errMsg}`,
    }
  }
}

/**
 * Validates an endpoint and credentials by attempting model discovery.
 */
export async function proxyValidateEndpoint(
  options: ProxyFetchModelsOptions
): Promise<ProxyFetchModelsResult> {
  return proxyFetchModels(options)
}
