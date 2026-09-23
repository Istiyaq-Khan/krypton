import { describe, it, expect } from "vitest";
import { sanitizeBaseUrl } from "../src/config.js";

describe("Base URL Sanitization Utility (sanitizeBaseUrl)", () => {
  it("preserves standard OpenAI base URL without trailing slash", () => {
    expect(sanitizeBaseUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("strips /chat/completions from NVIDIA NIM base URL", () => {
    expect(
      sanitizeBaseUrl("https://integrate.api.nvidia.com/v1/chat/completions")
    ).toBe("https://integrate.api.nvidia.com/v1");
  });

  it("strips trailing slashes from NVIDIA NIM base URL", () => {
    expect(sanitizeBaseUrl("https://integrate.api.nvidia.com/v1/")).toBe(
      "https://integrate.api.nvidia.com/v1"
    );
  });

  it("strips /chat/completions/ with trailing slash from NVIDIA NIM base URL", () => {
    expect(
      sanitizeBaseUrl("https://integrate.api.nvidia.com/v1/chat/completions/")
    ).toBe("https://integrate.api.nvidia.com/v1");
  });

  it("preserves custom local ports with /v1 path", () => {
    expect(sanitizeBaseUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1"
    );
  });

  it("preserves custom local ports with trailing slash", () => {
    expect(sanitizeBaseUrl("http://localhost:11434/v1/")).toBe(
      "http://localhost:11434/v1"
    );
  });

  it("preserves root local port URL without path", () => {
    expect(sanitizeBaseUrl("http://localhost:11434")).toBe(
      "http://localhost:11434"
    );
    expect(sanitizeBaseUrl("http://localhost:11434/")).toBe(
      "http://localhost:11434"
    );
  });

  it("strips /models if pasted into base URL", () => {
    expect(sanitizeBaseUrl("https://integrate.api.nvidia.com/v1/models")).toBe(
      "https://integrate.api.nvidia.com/v1"
    );
    expect(sanitizeBaseUrl("https://integrate.api.nvidia.com/v1/models/")).toBe(
      "https://integrate.api.nvidia.com/v1"
    );
  });

  it("strips /messages from Anthropic base URL if pasted", () => {
    expect(sanitizeBaseUrl("https://api.anthropic.com/v1/messages")).toBe(
      "https://api.anthropic.com/v1"
    );
  });

  it("handles leading and trailing whitespace", () => {
    expect(sanitizeBaseUrl("   https://api.openai.com/v1/   ")).toBe(
      "https://api.openai.com/v1"
    );
    expect(
      sanitizeBaseUrl("  https://integrate.api.nvidia.com/v1/chat/completions  ")
    ).toBe("https://integrate.api.nvidia.com/v1");
  });

  it("handles empty and undefined inputs safely", () => {
    expect(sanitizeBaseUrl("")).toBe("");
    expect(sanitizeBaseUrl("   ")).toBe("");
    expect(sanitizeBaseUrl(undefined)).toBe("");
  });
});
