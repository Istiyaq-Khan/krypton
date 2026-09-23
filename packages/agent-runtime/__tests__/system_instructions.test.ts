import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  bootstrapKryptonHome,
  compileSystemPrompt,
  readSystemInstructions,
  updateSystemInstructions,
  resolveValidatedInstructionPath,
  registerSystemInstructionTools,
  Agent,
  ToolRegistry,
  McpClientManager,
} from "../src/index.js";

describe("File-Driven System Prompt Engine & Self-Updating Tooling", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-prompt-engine-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("1. Seeds ~/.krypton/system.md and ~/.krypton/agents/root.md when initializing an empty directory", async () => {
    const res = await bootstrapKryptonHome({ customRoot: tempRoot });
    expect(res.kryptonHome).toBe(path.resolve(tempRoot));

    const systemMdPath = path.join(tempRoot, "system.md");
    const rootAgentMdPath = path.join(tempRoot, "agents", "root.md");

    expect(fs.existsSync(systemMdPath)).toBe(true);
    expect(fs.existsSync(rootAgentMdPath)).toBe(true);

    const systemContent = fs.readFileSync(systemMdPath, "utf-8");
    expect(systemContent).toContain("# Krypton Autonomous Operating System — Root Directives");
    expect(systemContent).toContain("Core Operational Principles");
    expect(systemContent).toContain("Multi-Tier Verification");

    const rootContent = fs.readFileSync(rootAgentMdPath, "utf-8");
    expect(rootContent).toContain("# Root Supervisor Agent — Profile & Scope");
    expect(rootContent).toContain("Reasoning Tone & Behavior");
  });

  it("2. compileSystemPrompt exclusively assembles system prompt from system.md and root.md/agent.md, ignoring legacy multi-file directory structures", async () => {
    await bootstrapKryptonHome({ customRoot: tempRoot });

    // Custom system.md
    const systemMdPath = path.join(tempRoot, "system.md");
    fs.writeFileSync(
      systemMdPath,
      "---\ntitle: system\n---\n# Root System Rules\n1. Maintain zero downtime.\n2. Always verify tests.\n",
      "utf-8"
    );

    // Agent profile markdown: ~/.krypton/agents/TestSupervisor.md
    const agentMdPath = path.join(tempRoot, "agents", "TestSupervisor.md");
    fs.writeFileSync(
      agentMdPath,
      "# TestSupervisor Profile\nCoordinates high-level task workflows.\nAnalytical and rigorous.",
      "utf-8"
    );

    // Legacy directory with IDENTITY.md and SOUL.md that must be completely ignored
    const legacyAgentDir = path.join(tempRoot, "agents", "TestSupervisor");
    fs.mkdirSync(legacyAgentDir, { recursive: true });
    fs.writeFileSync(
      path.join(legacyAgentDir, "IDENTITY.md"),
      "# Legacy Persona Should Be Ignored",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(legacyAgentDir, "SOUL.md"),
      "# Legacy Soul Should Be Ignored",
      "utf-8"
    );

    // Active BOOTSTRAP.md in agent dir
    fs.writeFileSync(
      path.join(legacyAgentDir, "BOOTSTRAP.md"),
      "# Active Onboarding\nComplete beat 1 and beat 2.",
      "utf-8"
    );

    const compiled = await compileSystemPrompt({
      agentName: "TestSupervisor",
      customRoot: tempRoot,
    });

    // Verify sections and ordering
    expect(compiled).toContain("# Root System Rules");
    expect(compiled).toContain("1. Maintain zero downtime.");
    expect(compiled).not.toContain("title: system"); // Frontmatter stripped
    expect(compiled).toContain("# TestSupervisor Profile");
    expect(compiled).toContain("Coordinates high-level task workflows.");
    // Verify legacy multi-file artifacts are completely ignored
    expect(compiled).not.toContain("Legacy Persona Should Be Ignored");
    expect(compiled).not.toContain("Legacy Soul Should Be Ignored");
    // Verify bootstrap inclusion
    expect(compiled).toContain("CRITICAL ONBOARDING DIRECTIVE: ACTIVE BOOTSTRAP PROTOCOL DETECTED");
    expect(compiled).toContain("Complete beat 1 and beat 2.");
  });

  it("3. readSystemInstructions reads system.md and agent instructions safely", async () => {
    await bootstrapKryptonHome({ customRoot: tempRoot });

    const readDefault = await readSystemInstructions("system.md", { customRoot: tempRoot });
    expect(readDefault.success).toBe(true);
    expect(readDefault.content).toContain("Krypton Autonomous Operating System");

    const readRootAgent = await readSystemInstructions("agents/root.md", { customRoot: tempRoot });
    expect(readRootAgent.success).toBe(true);
    expect(readRootAgent.content).toContain("Root Supervisor Agent");

    const readNonExistent = await readSystemInstructions("non_existent.md", { customRoot: tempRoot });
    expect(readNonExistent.success).toBe(false);
    expect(readNonExistent.message).toContain("not found");
  });

  it("4. updateSystemInstructions safely overwrites and appends to markdown files with atomic writes", async () => {
    await bootstrapKryptonHome({ customRoot: tempRoot });

    // 1. Overwrite system.md
    const newRules = "# Custom System Directives\nStrict sandbox execution enforced.\n";
    const updateRes = await updateSystemInstructions(
      {
        targetFile: "system.md",
        content: newRules,
        mode: "overwrite",
      },
      { customRoot: tempRoot }
    );
    expect(updateRes.success).toBe(true);
    expect(updateRes.bytesWritten).toBeGreaterThan(0);

    const systemContent = fs.readFileSync(path.join(tempRoot, "system.md"), "utf-8");
    expect(systemContent).toBe(newRules);

    // 2. Append to system.md
    const appendedLine = "## Rule 2: Never delete root logs without approval.";
    const appendRes = await updateSystemInstructions(
      {
        targetFile: "system.md",
        content: appendedLine,
        mode: "append",
      },
      { customRoot: tempRoot }
    );
    expect(appendRes.success).toBe(true);

    const updatedContent = fs.readFileSync(path.join(tempRoot, "system.md"), "utf-8");
    expect(updatedContent).toContain("Strict sandbox execution enforced.");
    expect(updatedContent).toContain(appendedLine);
  });

  it("5. Security Validation: Rejects path traversal and non-markdown file modifications", async () => {
    await bootstrapKryptonHome({ customRoot: tempRoot });

    // Attempt path traversal via relative navigation
    expect(() =>
      resolveValidatedInstructionPath("../../etc/passwd.md", { customRoot: tempRoot })
    ).toThrow(/Path traversal detected/);

    expect(() =>
      resolveValidatedInstructionPath("..\\..\\Windows\\System32\\calc.md", { customRoot: tempRoot })
    ).toThrow(/Path traversal detected/);

    // Attempt non-markdown target
    expect(() =>
      resolveValidatedInstructionPath("config.json", { customRoot: tempRoot })
    ).toThrow(/must have a '\.md' extension/);

    expect(() =>
      resolveValidatedInstructionPath("credentials.enc", { customRoot: tempRoot })
    ).toThrow(/must have a '\.md' extension/);

    // Via updateSystemInstructions
    const badUpdate = await updateSystemInstructions(
      {
        targetFile: "../evil.md",
        content: "Malicious payload",
        mode: "overwrite",
      },
      { customRoot: tempRoot }
    );
    expect(badUpdate.success).toBe(false);
    expect(badUpdate.message).toContain("Path traversal detected");
  });

  it("6. Agent.executeBuiltinTool handles read_system_instructions and update_system_instructions", async () => {
    await bootstrapKryptonHome({ customRoot: tempRoot, defaultAgentName: "WorkerAgent" });

    const agent = new Agent({
      name: "WorkerAgent",
      customRoot: tempRoot,
    });

    // Execute read tool
    const readResult = await agent.executeBuiltinTool("read_system_instructions", {
      targetFile: "system.md",
    });
    expect(readResult.success).toBe(true);
    expect(readResult.content).toContain("Krypton Autonomous Operating System");

    // Execute update tool
    const updateResult = await agent.executeBuiltinTool("update_system_instructions", {
      targetFile: "system.md",
      content: "# Autonomous Live Update\nAgent adjusted operational directives at runtime.",
      mode: "overwrite",
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.content).toContain("Successfully updated system.md");

    // Verify persistence
    const reReadResult = await agent.executeBuiltinTool("read_system_instructions", {
      targetFile: "system.md",
    });
    expect(reReadResult.success).toBe(true);
    expect(reReadResult.content).toContain("Autonomous Live Update");
  });

  it("7. ToolRegistry registers read_system_instructions and update_system_instructions with unified schemas", async () => {
    await bootstrapKryptonHome({ customRoot: tempRoot });

    const clientManager = new McpClientManager();
    const registry = new ToolRegistry(clientManager);
    registerSystemInstructionTools(registry, { customRoot: tempRoot });

    const openAITools = registry.toOpenAIFunctions();
    const anthropicTools = registry.toAnthropicTools();

    const openAINames = openAITools.map((t) => t.function.name);
    expect(openAINames).toContain("system__read_system_instructions");
    expect(openAINames).toContain("system__update_system_instructions");

    const anthropicNames = anthropicTools.map((t) => t.name);
    expect(anthropicNames).toContain("system__read_system_instructions");
    expect(anthropicNames).toContain("system__update_system_instructions");

    // Execute via registry.invokeTool
    const invokeRes = await registry.invokeTool({
      requestId: "00000000-0000-0000-0000-000000000001",
      agentId: "00000000-0000-0000-0000-000000000002",
      toolName: "read_system_instructions",
      parameters: { targetFile: "system.md" },
    });

    expect(invokeRes.isError).toBe(false);
    expect(invokeRes.stdout).toContain("Krypton Autonomous Operating System");
  });
});
