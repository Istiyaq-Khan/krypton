import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SetupConfigPayloadSchema } from "@krypton/shared-types";

describe("Setup Wizard Refactoring: File-Driven System Prompt Engine", () => {
  const wizardSourcePath = path.resolve(__dirname, "../src/components/setup/FirstRunSetupWizard.tsx");
  const rustPathsSourcePath = path.resolve(__dirname, "../src-tauri/src/paths.rs");

  it("1. FirstRunSetupWizard.tsx: Permanently removes manual Agent Role and Reasoning Tone forms", () => {
    expect(fs.existsSync(wizardSourcePath)).toBe(true);
    const source = fs.readFileSync(wizardSourcePath, "utf-8");

    // Must NOT contain manual role input or label
    expect(source).not.toContain("Agent Role & Operating Directive");
    expect(source).not.toContain("setAgentRole");

    // Must NOT contain reasoning style & tone cards
    expect(source).not.toContain("Reasoning Style & Tone");
    expect(source).not.toContain("setReasoningTone");
    expect(source).not.toContain("Strict & Analytical");
    expect(source).not.toContain("Autonomous Agile");
    expect(source).not.toContain("Research & Synthesis");

    // Must display file-driven prompt indicator badge in Step 1
    expect(source).toContain("File-Driven System Prompt Architecture");
    expect(source).toContain("~/.krypton/system.md");
    expect(source).toContain("~/.krypton/agents/root.md");
  });

  it("2. SetupConfigPayloadSchema: Validates payload with omitted or optional agentRole", () => {
    // Valid minimal payload with only agentName
    const parsed = SetupConfigPayloadSchema.parse({
      agentName: "Orchestrator",
      provider: "openai",
      primaryModel: "gpt-4o",
    });

    expect(parsed.agentName).toBe("Orchestrator");
    expect(parsed.agentRole).toBeUndefined();

    // Valid without any agentRole supplied at all
    const defaultPayload = SetupConfigPayloadSchema.parse({});
    expect(defaultPayload.agentName).toBe("Orchestrator");
    expect(defaultPayload.agentRole).toBeUndefined();

    // Rejects empty agentName
    expect(() => SetupConfigPayloadSchema.parse({ agentName: "" })).toThrow(/Agent name is required/);
  });

  it("3. Rust paths.rs: Scaffolds ~/.krypton/system.md and ~/.krypton/agents/root.md", () => {
    expect(fs.existsSync(rustPathsSourcePath)).toBe(true);
    const rustSource = fs.readFileSync(rustPathsSourcePath, "utf-8");

    expect(rustSource).toContain("system.md");
    expect(rustSource).toContain("root.md");
    expect(rustSource).toContain("Krypton Autonomous Operating System");
    expect(rustSource).toContain("Root Supervisor Agent");
  });
});
