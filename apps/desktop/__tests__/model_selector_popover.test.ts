import { describe, it, expect } from "vitest"
import { DiscoveredModel } from "../src/lib/modelDiscovery"

describe("ModelSelectorPopover Component Logic & Family Classification", () => {
  // Classification logic test
  function classifyModel(model: DiscoveredModel) {
    const idLower = (model.id || "").toLowerCase()
    const nameLower = (model.name || "").toLowerCase()
    const ownerLower = (model.ownedBy || "").toLowerCase()

    if (idLower.includes("claude") || nameLower.includes("claude") || ownerLower.includes("anthropic")) {
      return "anthropic"
    }
    if (
      idLower.includes("gpt") ||
      idLower.includes("o1") ||
      idLower.includes("o3") ||
      nameLower.includes("gpt") ||
      ownerLower.includes("openai")
    ) {
      return "openai"
    }
    if (idLower.includes("deepseek") || nameLower.includes("deepseek") || ownerLower.includes("deepseek")) {
      return "deepseek"
    }
    if (idLower.includes("gemini") || nameLower.includes("gemini") || ownerLower.includes("google")) {
      return "google"
    }
    if (idLower.includes("llama") || nameLower.includes("llama") || ownerLower.includes("meta")) {
      return "meta"
    }
    if (
      idLower.includes("qwen") ||
      idLower.includes("mistral") ||
      idLower.includes("phi") ||
      idLower.includes("local") ||
      ownerLower.includes("ollama")
    ) {
      return "local"
    }
    return "other"
  }

  function formatContextLength(tokens?: number): string | null {
    if (!tokens || tokens <= 0) return null
    if (tokens >= 1000000) {
      const m = tokens / 1000000
      return `${m % 1 === 0 ? m : m.toFixed(1)}M`
    }
    if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k`
    }
    return `${tokens}`
  }

  describe("Model Family Grouping Heuristics", () => {
    it("correctly identifies Anthropic Claude family models", () => {
      expect(classifyModel({ id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet" })).toBe("anthropic")
      expect(classifyModel({ id: "claude-3-5-haiku-20241022", ownedBy: "anthropic" })).toBe("anthropic")
    })

    it("correctly identifies OpenAI reasoning and GPT family models", () => {
      expect(classifyModel({ id: "gpt-4o", name: "GPT-4o", ownedBy: "openai" })).toBe("openai")
      expect(classifyModel({ id: "o1-preview" })).toBe("openai")
      expect(classifyModel({ id: "o3-mini", name: "o3-mini" })).toBe("openai")
    })

    it("correctly identifies DeepSeek models", () => {
      expect(classifyModel({ id: "deepseek-r1", name: "DeepSeek R1" })).toBe("deepseek")
      expect(classifyModel({ id: "deepseek-ai/DeepSeek-V3", ownedBy: "deepseek" })).toBe("deepseek")
    })

    it("correctly identifies Google Gemini models", () => {
      expect(classifyModel({ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" })).toBe("google")
      expect(classifyModel({ id: "gemini-2.0-flash", ownedBy: "google" })).toBe("google")
    })

    it("correctly identifies Meta Llama models", () => {
      expect(classifyModel({ id: "llama-3.3-70b", name: "Llama 3.3 70B" })).toBe("meta")
      expect(classifyModel({ id: "meta-llama/Llama-3.1-8B-Instruct" })).toBe("meta")
    })

    it("correctly identifies local / Ollama models", () => {
      expect(classifyModel({ id: "qwen2.5-coder:32b", ownedBy: "ollama" })).toBe("local")
      expect(classifyModel({ id: "mistral-small" })).toBe("local")
      expect(classifyModel({ id: "phi-4" })).toBe("local")
    })

    it("falls back to 'other' for unclassified custom model identifiers", () => {
      expect(classifyModel({ id: "custom-finetune-v1" })).toBe("other")
    })
  })

  describe("Context Window Formatting", () => {
    it("formats thousands of tokens into 'k' notation", () => {
      expect(formatContextLength(128000)).toBe("128k")
      expect(formatContextLength(200000)).toBe("200k")
      expect(formatContextLength(8192)).toBe("8k")
    })

    it("formats millions of tokens into 'M' notation", () => {
      expect(formatContextLength(1000000)).toBe("1M")
      expect(formatContextLength(2000000)).toBe("2M")
      expect(formatContextLength(1500000)).toBe("1.5M")
    })

    it("returns null for undefined, zero, or negative numbers", () => {
      expect(formatContextLength(undefined)).toBeNull()
      expect(formatContextLength(0)).toBeNull()
      expect(formatContextLength(-100)).toBeNull()
    })
  })

  describe("Search Filtering Engine", () => {
    const testCatalog: DiscoveredModel[] = [
      { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", description: "Hybrid reasoning", ownedBy: "anthropic" },
      { id: "gpt-4o", name: "GPT-4o", description: "Omni multimodal flagship", ownedBy: "openai" },
      { id: "deepseek-r1", name: "DeepSeek R1", description: "Open weights frontier reasoning", ownedBy: "deepseek" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Massive context", ownedBy: "google" },
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", description: "Local weights", ownedBy: "meta" },
    ]

    function filterModels(models: DiscoveredModel[], query: string): DiscoveredModel[] {
      const q = query.trim().toLowerCase()
      if (!q) return models
      return models.filter((m) => {
        const idMatch = (m.id || "").toLowerCase().includes(q)
        const nameMatch = (m.name || "").toLowerCase().includes(q)
        const descMatch = (m.description || "").toLowerCase().includes(q)
        const ownerMatch = (m.ownedBy || "").toLowerCase().includes(q)
        return idMatch || nameMatch || descMatch || ownerMatch
      })
    }

    it("filters models by model ID", () => {
      const res = filterModels(testCatalog, "deepseek")
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe("deepseek-r1")
    })

    it("filters models by description keywords", () => {
      const res = filterModels(testCatalog, "multimodal")
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe("gpt-4o")
    })

    it("filters models by provider owner", () => {
      const res = filterModels(testCatalog, "anthropic")
      expect(res).toHaveLength(1)
      expect(res[0].name).toBe("Claude 3.7 Sonnet")
    })

    it("returns empty array when query does not match any model", () => {
      const res = filterModels(testCatalog, "nonexistent-model-xyz")
      expect(res).toHaveLength(0)
    })

    it("returns all models when query is empty or whitespace", () => {
      const res = filterModels(testCatalog, "   ")
      expect(res).toHaveLength(5)
    })
  })
})
