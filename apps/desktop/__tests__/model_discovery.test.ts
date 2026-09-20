import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  testAndFetchModels,
  PROVIDER_METADATA,
  DEFAULT_PROVIDER_URLS,
  loadCachedModels,
  persistCachedModels,
} from "../src/lib/modelDiscovery"

describe("Krypton Model Discovery & Validation Engine", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    if (typeof window !== "undefined") {
      localStorage.clear()
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("1. Input Requirement Validation", () => {
    it("rejects OpenAI without API key", async () => {
      const result = await testAndFetchModels({ provider: "openai", apiKey: "" })
      expect(result.success).toBe(false)
      expect(result.error).toContain("OpenAI requires an API key")
    })

    it("rejects Anthropic without API key", async () => {
      const result = await testAndFetchModels({ provider: "anthropic", apiKey: "   " })
      expect(result.success).toBe(false)
      expect(result.error).toContain("Anthropic requires an API key")
    })

    it("rejects OpenRouter without API key", async () => {
      const result = await testAndFetchModels({ provider: "openrouter", apiKey: "" })
      expect(result.success).toBe(false)
      expect(result.error).toContain("OpenRouter requires an API key")
    })

    it("rejects Ollama when baseUrl is explicitly empty", async () => {
      const result = await testAndFetchModels({ provider: "ollama", baseUrl: " " })
      expect(result.success).toBe(false)
      expect(result.error).toContain("Please provide a valid Base URL for Ollama")
    })
  })

  describe("2. Dynamic Discovery by Provider", () => {
    it("successfully discovers models from OpenAI format endpoint", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "gpt-4o", created: 1715368132 },
            { id: "gpt-4o-mini", created: 1721262000 },
          ],
        }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "openai",
        apiKey: "sk-proj-test12345",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(res.models.map((m) => m.id)).toEqual(["gpt-4o", "gpt-4o-mini"])
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-proj-test12345",
          }),
        })
      )
    })

    it("successfully discovers models from Anthropic format endpoint", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "claude-3-7-sonnet-20250219", display_name: "Claude 3.7 Sonnet" },
            { id: "claude-3-5-haiku-20241022", display_name: "Claude 3.5 Haiku" },
          ],
        }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "anthropic",
        apiKey: "sk-ant-testkey",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(res.models[0].id).toBe("claude-3-5-haiku-20241022")
      expect(res.models[1].id).toBe("claude-3-7-sonnet-20250219")
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "sk-ant-testkey",
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          }),
        })
      )
    })

    it("discovers models from Ollama /v1/models", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "llama3.2:latest" }, { id: "deepseek-r1:8b" }],
        }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(res.models.map((m) => m.id)).toEqual(["deepseek-r1:8b", "llama3.2:latest"])
    })

    it("falls back to Ollama /api/tags if /v1/models returns 404", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: async () => ({ error: "Not found" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            models: [
              { name: "qwen2.5-coder:7b", details: { family: "qwen" } },
              { name: "mistral:latest", details: { family: "llama" } },
            ],
          }),
        } as Response)

      const res = await testAndFetchModels({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(res.models[0].id).toBe("mistral:latest")
      expect(res.models[1].id).toBe("qwen2.5-coder:7b")
    })

    it("discovers models from OpenRouter with custom headers", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet", context_length: 200000 },
          ],
        }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "openrouter",
        apiKey: "sk-or-test1234",
        baseUrl: "https://openrouter.ai/api/v1",
      })

      expect(res.success).toBe(true)
      expect(res.models[0].id).toBe("anthropic/claude-3.7-sonnet")
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-test1234",
            "HTTP-Referer": "https://krypton.local",
            "X-Title": "Krypton Desktop",
          }),
        })
      )
    })

    it("successfully discovers models from NVIDIA NIM endpoint (OpenAI-compatible)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "meta/llama-3.3-70b-instruct", created: 1733443200 },
            { id: "deepseek-ai/deepseek-r1", created: 1737331200 },
          ],
        }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "openai",
        apiKey: "nvapi-testkey-12345",
        baseUrl: "https://integrate.api.nvidia.com/v1",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(res.models[0].id).toBe("deepseek-ai/deepseek-r1")
      expect(res.models[1].id).toBe("meta/llama-3.3-70b-instruct")
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://integrate.api.nvidia.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer nvapi-testkey-12345",
          }),
        })
      )
    })
  })

  describe("3. Error Diagnosis and Handling", () => {
    it("returns clean authentication error banner on HTTP 401", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Incorrect API key provided." } }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "openai",
        apiKey: "sk-invalid",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Authentication failed (401)")
      expect(res.error).toContain("Incorrect API key provided.")
    })

    it("returns descriptive rate limit / quota error on HTTP 429", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "You exceeded your current quota." } }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "openai",
        apiKey: "sk-valid-but-no-credits",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Rate limit / Quota exceeded (429)")
      expect(res.error).toContain("You exceeded your current quota.")
    })

    it("returns descriptive connection refused error when local Ollama is offline", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:11434"))

      const res = await testAndFetchModels({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Connection refused")
      expect(res.error).toContain("ollama serve")
    })

    it("returns timeout error when request exceeds timeout duration", async () => {
      const abortError = new Error("The operation was aborted")
      abortError.name = "AbortError"
      globalThis.fetch = vi.fn().mockRejectedValue(abortError)

      const res = await testAndFetchModels({
        provider: "custom",
        baseUrl: "http://10.255.255.1:8000/v1",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Request timed out after 10 seconds")
    })

    it("returns access denied error on HTTP 403", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Forbidden resource." } }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "anthropic",
        apiKey: "sk-ant-restricted",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Access denied (403)")
      expect(res.error).toContain("Forbidden resource.")
    })

    it("returns endpoint not found error on HTTP 404", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Route not found" }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "custom",
        baseUrl: "http://localhost:8000/wrong-route",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Endpoint not found (404)")
    })

    it("returns helpful message when Ollama endpoint returns zero models", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("ollama pull <model>")
    })

    it("returns descriptive server error banner on HTTP 500-504", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      } as Response)

      const res = await testAndFetchModels({
        provider: "openai",
        apiKey: "sk-test-key",
        baseUrl: "https://api.my-cluster.com/v1",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Upstream server error (503)")
    })
  })

  describe("4. Provider Metadata & Defaults Validation", () => {
    it("defines valid metadata and default URLs for all 5 providers", () => {
      const providers = ["openai", "anthropic", "ollama", "openrouter", "custom"] as const
      for (const p of providers) {
        expect(PROVIDER_METADATA[p]).toBeDefined()
        expect(PROVIDER_METADATA[p].name.length).toBeGreaterThan(0)
        expect(DEFAULT_PROVIDER_URLS[p]).toBeDefined()
      }

      expect(PROVIDER_METADATA.openai.requiresApiKey).toBe(true)
      expect(PROVIDER_METADATA.anthropic.requiresApiKey).toBe(true)
      expect(PROVIDER_METADATA.openrouter.requiresApiKey).toBe(true)
      expect(PROVIDER_METADATA.ollama.requiresApiKey).toBe(false)
      expect(PROVIDER_METADATA.custom.requiresApiKey).toBe(false)
    })
  })

  describe("5. Local Caching Lifecycle", () => {
    it("persists and reloads cached models correctly", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
      ]

      await persistCachedModels({
        provider: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        models: mockModels,
        updatedAt: 1726700000000,
      })

      const cached = await loadCachedModels()
      expect(cached).not.toBeNull()
      expect(cached?.provider).toBe("openrouter")
      expect(cached?.models.length).toBe(2)
      expect(cached?.models[0].id).toBe("gpt-4o")
    })
  })

  describe("6. Backend Proxy IPC Channel", () => {
    it("routes through daemon proxy when useProxy is specified", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          provider: "openai",
          models: [{ id: "meta/llama-3.3-70b-instruct" }],
        }),
      } as Response)

      const res = await testAndFetchModels({
        provider: "openai",
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        useProxy: true,
      })

      expect(res.success).toBe(true)
      expect(res.models[0].id).toBe("meta/llama-3.3-70b-instruct")
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:19840/api/fetch-models",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            provider: "openai",
            apiKey: "nvapi-test",
            baseUrl: "https://integrate.api.nvidia.com/v1",
          }),
        })
      )
    })
  })
})
