import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  proxyFetchModels,
  resolveTargetModelsUrl,
  proxyValidateEndpoint,
} from "../src/proxy/model-proxy.js"

describe("Backend Model Proxy & Endpoint Discovery Engine", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("1. URL Resolution & Normalization", () => {
    it("normalizes OpenAI endpoint without /models", () => {
      const url = resolveTargetModelsUrl("openai", "https://api.openai.com/v1")
      expect(url).toBe("https://api.openai.com/v1/models")
    })

    it("normalizes NVIDIA NIM endpoint", () => {
      const url = resolveTargetModelsUrl("openai", "https://integrate.api.nvidia.com/v1")
      expect(url).toBe("https://integrate.api.nvidia.com/v1/models")
    })

    it("does not duplicate /models if already present", () => {
      const url = resolveTargetModelsUrl("openai", "https://api.openai.com/v1/models")
      expect(url).toBe("https://api.openai.com/v1/models")
    })

    it("normalizes Anthropic endpoint", () => {
      const url = resolveTargetModelsUrl("anthropic", "https://api.anthropic.com/v1")
      expect(url).toBe("https://api.anthropic.com/v1/models")
    })
  })

  describe("2. OpenAI-Compatible Discovery & NVIDIA NIM", () => {
    it("successfully fetches models from OpenAI format roster", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "gpt-4o", created: 1715368132, owned_by: "openai" },
            { id: "gpt-4o-mini", created: 1721262000, owned_by: "openai" },
          ],
        }),
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        apiKey: "sk-proj-test12345",
        baseUrl: "https://api.openai.com/v1",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(res.models[0].id).toBe("gpt-4o")
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-proj-test12345",
            Accept: "application/json",
          }),
        })
      )
    })

    it("successfully discovers models from NVIDIA NIM endpoint", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "meta/llama-3.3-70b-instruct", created: 1733443200, owned_by: "nvidia" },
            { id: "deepseek-ai/deepseek-r1", created: 1737331200, owned_by: "nvidia" },
          ],
        }),
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        apiKey: "nvapi-sample-key",
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
            Authorization: "Bearer nvapi-sample-key",
          }),
        })
      )
    })
  })

  describe("3. Anthropic-Compatible Discovery", () => {
    it("successfully fetches models using x-api-key and anthropic-version headers", async () => {
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

      const res = await proxyFetchModels({
        provider: "anthropic",
        apiKey: "sk-ant-test-key",
      })

      expect(res.success).toBe(true)
      expect(res.models.length).toBe(2)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "sk-ant-test-key",
            "anthropic-version": "2023-06-01",
          }),
        })
      )
    })

    it("rejects Anthropic discovery if API key is missing", async () => {
      const res = await proxyFetchModels({
        provider: "anthropic",
        apiKey: "",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Anthropic-Compatible requires an API key")
    })
  })

  describe("4. Diagnostic Error Banner Mapping", () => {
    it("maps 401 to authentication failure message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid API key" } }),
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        apiKey: "sk-bad-key",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Authentication failed (401)")
      expect(res.error).toContain("Invalid API key")
    })

    it("maps 403 to access denied message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        apiKey: "sk-restricted",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Access denied (403)")
    })

    it("maps 404 to endpoint not found message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        baseUrl: "https://my-server.com/wrong-path",
        apiKey: "key",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Endpoint not found (404)")
    })

    it("maps 429 to rate limit / quota exceeded message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Quota exceeded" } }),
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        apiKey: "sk-quota-depleted",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Rate limit / Quota exceeded (429)")
    })

    it("maps 500-504 to upstream server error message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      } as Response)

      const res = await proxyFetchModels({
        provider: "openai",
        apiKey: "sk-test",
        baseUrl: "https://api.my-llm.com/v1",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Upstream server error (503)")
    })

    it("handles connection refused gracefully", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8000"))

      const res = await proxyValidateEndpoint({
        provider: "openai",
        baseUrl: "http://127.0.0.1:8000/v1",
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Connection refused")
    })

    it("handles timeout gracefully", async () => {
      const abortErr = new Error("The operation was aborted")
      abortErr.name = "AbortError"
      globalThis.fetch = vi.fn().mockRejectedValue(abortErr)

      const res = await proxyFetchModels({
        provider: "openai",
        baseUrl: "http://10.255.255.1/v1",
        timeoutMs: 500,
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain("Request timed out")
    })
  })
})
