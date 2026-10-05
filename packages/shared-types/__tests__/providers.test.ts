import { describe, it, expect } from "vitest";
import {
  parseNamespacedModel,
  formatNamespacedModel,
  findCatalogProvider,
  normalizeCredential,
  PROVIDER_CATALOG,
} from "../src/providers.js";

describe("Namespaced Model Identifiers & Provider Catalog", () => {
  describe("1. parseNamespacedModel", () => {
    it("splits namespaced model identifier strictly on the first forward slash", () => {
      const parsed = parseNamespacedModel("openai/gpt-4o");
      expect(parsed.providerId).toBe("openai");
      expect(parsed.modelId).toBe("gpt-4o");
      expect(parsed.isNamespaced).toBe(true);
    });

    it("handles multi-slash models such as NVIDIA NIM hosted models", () => {
      const parsed = parseNamespacedModel("nvidia/meta/llama-3.3-70b-instruct");
      expect(parsed.providerId).toBe("nvidia");
      expect(parsed.modelId).toBe("meta/llama-3.3-70b-instruct");
      expect(parsed.isNamespaced).toBe(true);
    });

    it("handles local runtime namespaced models", () => {
      const parsed = parseNamespacedModel("ollama/deepseek-r1:8b");
      expect(parsed.providerId).toBe("ollama");
      expect(parsed.modelId).toBe("deepseek-r1:8b");
      expect(parsed.isNamespaced).toBe(true);
    });

    it("gracefully infers provider for legacy non-namespaced Anthropic models", () => {
      const parsed = parseNamespacedModel("claude-3-7-sonnet-20250219");
      expect(parsed.providerId).toBe("anthropic");
      expect(parsed.modelId).toBe("claude-3-7-sonnet-20250219");
      expect(parsed.isNamespaced).toBe(false);
    });

    it("gracefully infers provider for legacy non-namespaced OpenAI models", () => {
      const parsed = parseNamespacedModel("gpt-4o-mini");
      expect(parsed.providerId).toBe("openai");
      expect(parsed.modelId).toBe("gpt-4o-mini");
      expect(parsed.isNamespaced).toBe(false);
    });

    it("uses defaultProvider override when no slash is present", () => {
      const parsed = parseNamespacedModel("custom-fine-tuned", "groq");
      expect(parsed.providerId).toBe("groq");
      expect(parsed.modelId).toBe("custom-fine-tuned");
      expect(parsed.isNamespaced).toBe(false);
    });
  });

  describe("2. formatNamespacedModel", () => {
    it("formats provider and model into canonical namespaced identifier", () => {
      expect(formatNamespacedModel("openai", "gpt-4o")).toBe("openai/gpt-4o");
      expect(formatNamespacedModel("anthropic", "claude-3-7-sonnet")).toBe("anthropic/claude-3-7-sonnet");
    });

    it("avoids redundant provider prefix if model is already prefixed", () => {
      expect(formatNamespacedModel("nvidia", "nvidia/meta/llama-3.3-70b-instruct")).toBe(
        "nvidia/meta/llama-3.3-70b-instruct"
      );
    });
  });

  describe("3. Provider Catalog Registry", () => {
    it("contains all 64 standardized providers from provider.json", () => {
      expect(PROVIDER_CATALOG.length).toBeGreaterThanOrEqual(60);
    });

    it("successfully finds major AI providers by id or name", () => {
      const openai = findCatalogProvider("openai");
      expect(openai).toBeDefined();
      expect(openai?.protocol).toBe("openai");
      expect(openai?.apiUrl).toBe("https://api.openai.com/v1");

      const anthropic = findCatalogProvider("anthropic");
      expect(anthropic).toBeDefined();
      expect(anthropic?.protocol).toBe("anthropic");

      const nvidia = findCatalogProvider("nvidia");
      expect(nvidia).toBeDefined();
      expect(nvidia?.apiUrl).toBe("https://integrate.api.nvidia.com/v1");

      const deepseek = findCatalogProvider("deepseek");
      expect(deepseek).toBeDefined();

      const ollama = findCatalogProvider("ollama");
      expect(ollama).toBeDefined();
      expect(ollama?.isLocal).toBe(true);
    });
  });

  describe("4. normalizeCredential", () => {
    it("normalizes plain string to plain_text credential", () => {
      const cred = normalizeCredential("sk-proj-12345");
      expect(cred).toEqual({ type: "plain_text", token: "sk-proj-12345" });
    });

    it("normalizes env: prefix to env_var credential", () => {
      const cred = normalizeCredential("env:OPENAI_API_KEY");
      expect(cred).toEqual({ type: "env_var", envVar: "OPENAI_API_KEY" });
    });

    it("normalizes vault: prefix to vault credential", () => {
      const cred = normalizeCredential("vault:nvidia_api_key");
      expect(cred).toEqual({ type: "vault", keyId: "nvidia_api_key" });
    });

    it("handles undefined/empty input", () => {
      expect(normalizeCredential(undefined)).toBeUndefined();
      expect(normalizeCredential("")).toBeUndefined();
    });
  });
});
