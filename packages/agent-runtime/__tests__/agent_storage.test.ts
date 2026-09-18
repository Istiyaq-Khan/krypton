import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  bootstrapAgentWorkspace,
  readAgentConfig,
  writeAgentConfig,
  updateAgentConfig,
  readAgentContextMarkdown,
  writeAgentContextMarkdown,
  loadAgentContext,
  Agent,
  KryptonDaemonServer,
} from "../src/index.js";
import { AgentConfigFileSchema } from "@krypton/shared-types";

describe("Agent Storage Decoupling: Structured config.json & Pure Context Markdown", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-agent-storage-test-"));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("creates valid config.json and pure markdown context on workspace bootstrap", async () => {
    const agentName = "CodeArchitect";
    const result = await bootstrapAgentWorkspace(agentName, {
      customRoot: tempRoot,
      initialConfig: {
        role: "Senior Code Architect",
        model: "claude-3-7-sonnet-20250219",
        provider: "anthropic",
        temperature: 0.1,
        tools: ["terminal", "filesystem", "astLinter"],
        permissions: {
          allowedSubAgents: ["WorkerBot"],
          allowedTools: ["terminal", "filesystem", "astLinter"],
          maxDepth: 2,
          maxConcurrentChildren: 4,
          budgetShare: 0.6,
          canSynthesizeTools: true,
          canAccessNetwork: true,
          canModifyWorkspace: true,
          terminal: true,
          filesystem: true,
          web: false,
          astLinter: true,
        },
      },
    });

    const agentDir = result.agentDir;
    const configPath = path.join(agentDir, "config.json");

    // 1. config.json must exist
    expect(fs.existsSync(configPath)).toBe(true);

    const rawJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const validated = AgentConfigFileSchema.parse(rawJson);

    expect(validated.name).toBe(agentName);
    expect(validated.role).toBe("Senior Code Architect");
    expect(validated.model).toBe("claude-3-7-sonnet-20250219");
    expect(validated.provider).toBe("anthropic");
    expect(validated.temperature).toBe(0.1);
    expect(validated.permissions.maxDepth).toBe(2);
    expect(validated.permissions.allowedSubAgents).toContain("WorkerBot");
    expect(validated.budget.total).toBe(100_000);
    expect(validated.budget.used).toBe(0);

    // 2. Markdown files must exist and be strictly for context
    const identityPath = path.join(agentDir, "IDENTITY.md");
    const soulPath = path.join(agentDir, "SOUL.md");
    const agentsPath = path.join(agentDir, "AGENTS.md");

    expect(fs.existsSync(identityPath)).toBe(true);
    expect(fs.existsSync(soulPath)).toBe(true);
    expect(fs.existsSync(agentsPath)).toBe(true);

    // Verify readAgentContextMarkdown yields clean prompt text
    const pureIdentity = await readAgentContextMarkdown(agentDir, "IDENTITY.md");
    expect(pureIdentity).toContain("IDENTITY.md - Who Am I?");
    expect(pureIdentity.startsWith("---")).toBe(false);

    const pureSoul = await readAgentContextMarkdown(agentDir, "SOUL.md");
    expect(pureSoul).toContain("SOUL.md - Who You Are");
    expect(pureSoul.startsWith("---")).toBe(false);
  });

  it("modifying settings updates config.json without altering context markdown files", async () => {
    const agentName = "SecurityAuditor";
    await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot });

    const agentDir = path.join(tempRoot, "agents", agentName);
    const identityPath = path.join(agentDir, "IDENTITY.md");
    const soulPath = path.join(agentDir, "SOUL.md");
    const agentsPath = path.join(agentDir, "AGENTS.md");

    const originalIdentity = fs.readFileSync(identityPath, "utf-8");
    const originalSoul = fs.readFileSync(soulPath, "utf-8");
    const originalAgents = fs.readFileSync(agentsPath, "utf-8");

    // Update settings in config.json
    const updated = await updateAgentConfig(
      agentName,
      {
        model: "deepseek-r1",
        temperature: 0.05,
        role: "Penetration Tester",
        permissions: {
          allowedSubAgents: ["ExploitTester"],
          allowedTools: ["terminal", "astLinter"],
          maxDepth: 1,
          maxConcurrentChildren: 2,
          budgetShare: 0.3,
          canSynthesizeTools: false,
          canAccessNetwork: false,
          canModifyWorkspace: false,
          terminal: true,
          filesystem: false,
          web: false,
          astLinter: true,
        },
      },
      { customRoot: tempRoot }
    );

    expect(updated.model).toBe("deepseek-r1");
    expect(updated.temperature).toBe(0.05);
    expect(updated.role).toBe("Penetration Tester");
    expect(updated.permissions.maxDepth).toBe(1);

    // Verify config.json on disk matches
    const reloaded = await readAgentConfig(agentName, { customRoot: tempRoot });
    expect(reloaded.model).toBe("deepseek-r1");
    expect(reloaded.role).toBe("Penetration Tester");

    // STRICT ISOLATION ASSERTION: Markdown context files must be byte-for-byte identical
    expect(fs.readFileSync(identityPath, "utf-8")).toBe(originalIdentity);
    expect(fs.readFileSync(soulPath, "utf-8")).toBe(originalSoul);
    expect(fs.readFileSync(agentsPath, "utf-8")).toBe(originalAgents);
  });

  it("modifying context markdown files does not alter config.json", async () => {
    const agentName = "DocsWriter";
    await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot });

    const agentDir = path.join(tempRoot, "agents", agentName);
    const configPath = path.join(agentDir, "config.json");
    const originalConfigRaw = fs.readFileSync(configPath, "utf-8");

    // Write new prompt context to IDENTITY.md
    const newPrompt = "# Technical Documentation Specialist\n\nWrite exhaustive, precise API docs.\n";
    await writeAgentContextMarkdown(agentName, "IDENTITY.md", newPrompt, {
      customRoot: tempRoot,
    });

    const readBackPrompt = await readAgentContextMarkdown(agentName, "IDENTITY.md", {
      customRoot: tempRoot,
    });
    expect(readBackPrompt.trim()).toBe(newPrompt.trim());

    // STRICT ISOLATION ASSERTION: config.json must remain identical
    const currentConfigRaw = fs.readFileSync(configPath, "utf-8");
    expect(currentConfigRaw).toBe(originalConfigRaw);
  });

  it("safely migrates legacy agent directories with frontmatter to compliant config.json", async () => {
    const legacyAgentName = "LegacyAgent";
    const agentDir = path.join(tempRoot, "agents", legacyAgentName);
    fs.mkdirSync(agentDir, { recursive: true });

    // Create legacy IDENTITY.md with YAML frontmatter containing configuration keys
    const legacyIdentity = `---
role: "Legacy Researcher"
model: "gpt-4o"
temperature: 0.65
tools:
  - web
  - filesystem
---

# Identity
You are a legacy research agent.`;
    fs.writeFileSync(path.join(agentDir, "IDENTITY.md"), legacyIdentity, "utf-8");

    // Create legacy AGENTS.md with frontmatter recursion caps
    const legacyAgents = `---
maxDepth: 1
allowedTools:
  - web
---

# Conventions
Do not delete files.`;
    fs.writeFileSync(path.join(agentDir, "AGENTS.md"), legacyAgents, "utf-8");

    // Notice: config.json is intentionally MISSING in this legacy workspace
    expect(fs.existsSync(path.join(agentDir, "config.json"))).toBe(false);

    // Call readAgentConfig - must self-heal and migrate
    const migrated = await readAgentConfig(legacyAgentName, { customRoot: tempRoot });

    expect(migrated.name).toBe(legacyAgentName);
    expect(migrated.role).toBe("Legacy Researcher");
    expect(migrated.model).toBe("gpt-4o");
    expect(migrated.temperature).toBe(0.65);
    expect(migrated.tools).toContain("web");
    expect(migrated.permissions.maxDepth).toBe(1);

    // Verify config.json was created on disk
    expect(fs.existsSync(path.join(agentDir, "config.json"))).toBe(true);

    // Verify readAgentContextMarkdown strips the legacy frontmatter
    const cleanPrompt = await readAgentContextMarkdown(legacyAgentName, "IDENTITY.md", {
      customRoot: tempRoot,
    });
    expect(cleanPrompt).not.toContain("role: \"Legacy Researcher\"");
    expect(cleanPrompt).toContain("# Identity");
    expect(cleanPrompt).toContain("You are a legacy research agent.");
  });

  it("loads Agent.fromWorkspace with configuration from config.json and system prompt from pure markdown", async () => {
    const agentName = "ActorAgent";
    await bootstrapAgentWorkspace(agentName, {
      customRoot: tempRoot,
      initialConfig: {
        role: "Distributed Actor",
        model: "claude-3-7-sonnet-20250219",
        permissions: {
          allowedSubAgents: [],
          allowedTools: ["terminal"],
          maxDepth: 2,
          maxConcurrentChildren: 3,
          budgetShare: 0.5,
          canSynthesizeTools: true,
          canAccessNetwork: false,
          canModifyWorkspace: true,
          terminal: true,
          filesystem: false,
          web: false,
          astLinter: false,
        },
      },
    });

    const customDirective = "Always enforce AST safety before any patch execution.";
    await writeAgentContextMarkdown(agentName, "SOUL.md", customDirective, {
      customRoot: tempRoot,
    });

    const agent = await Agent.fromWorkspace(agentName, { customRoot: tempRoot });

    expect(agent.name).toBe(agentName);
    expect(agent.context.role).toBe("Distributed Actor");
    expect(agent.context.recursionBoundary.maxDepth).toBe(2);

    const msgs = agent.getMessages();
    const systemMsg = msgs.find((m) => m.role === "system");
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.content).toContain(customDirective);

    // Verify config method on Agent instance
    const cfg = await agent.getConfig();
    expect(cfg.model).toBe("claude-3-7-sonnet-20250219");

    // Update config via agent instance
    const updatedCfg = await agent.updateConfig({ model: "gpt-4o-mini" });
    expect(updatedCfg.model).toBe("gpt-4o-mini");
    const onDiskCfg = await readAgentConfig(agentName, { customRoot: tempRoot });
    expect(onDiskCfg.model).toBe("gpt-4o-mini");
  });

  it("loads complete context via loadAgentContext assembling combined system prompt", async () => {
    const agentName = "ContextTester";
    await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot });

    await writeAgentContextMarkdown(agentName, "IDENTITY.md", "I am ContextTester, an autonomous assistant.", {
      customRoot: tempRoot,
    });
    await writeAgentContextMarkdown(agentName, "SOUL.md", "Stay calm and analytical.", {
      customRoot: tempRoot,
    });
    await writeAgentContextMarkdown(agentName, "USER.md", "User prefers concise answers.", {
      customRoot: tempRoot,
    });

    const context = await loadAgentContext(agentName, { customRoot: tempRoot });

    expect(context.config.name).toBe(agentName);
    expect(context.prompts.identity).toContain("I am ContextTester");
    expect(context.prompts.soul).toContain("Stay calm and analytical.");
    expect(context.prompts.user).toContain("User prefers concise answers.");

    expect(context.combinedSystemPrompt).toContain("I am ContextTester");
    expect(context.combinedSystemPrompt).toContain("## Core Directives & Behavioral Guardrails");
    expect(context.combinedSystemPrompt).toContain("Stay calm and analytical.");
    expect(context.combinedSystemPrompt).toContain("## User Preferences & Directives");
    expect(context.combinedSystemPrompt).toContain("User prefers concise answers.");
  });

  it("synchronizes daemon RPC endpoints (listAgents, createAgent, getAgent, updateAgent, updateAgentContext)", async () => {
    const daemon = new KryptonDaemonServer();
    process.env.KRYPTON_HOME = tempRoot;

    try {
      // 1. createAgent RPC
      const createReq = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "createAgent",
        params: {
          name: "RpcAgent",
          role: "RPC Specialist",
          model: "claude-3-7-sonnet-20250219",
          temperature: 0.15,
          systemPrompt: "RPC agent prompt text without config.",
          permissions: {
            terminal: true,
            filesystem: true,
            web: true,
            astLinter: true,
          },
        },
      };

      const createRes = await daemon.handleRpcCall(createReq);
      expect(createRes.error).toBeUndefined();
      expect((createRes.result as any).agentName).toBe("RpcAgent");
      expect((createRes.result as any).config.role).toBe("RPC Specialist");

      // Verify config.json was created on disk
      const configPath = path.join(tempRoot, "agents", "RpcAgent", "config.json");
      expect(fs.existsSync(configPath)).toBe(true);
      const onDiskConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      expect(onDiskConfig.temperature).toBe(0.15);

      // Verify IDENTITY.md contains pure prompt text without config keys
      const identityContent = fs.readFileSync(path.join(tempRoot, "agents", "RpcAgent", "IDENTITY.md"), "utf-8");
      expect(identityContent).toContain("RPC agent prompt text without config.");
      expect(identityContent).not.toContain("role: \"RPC Specialist\"");

      // 2. listAgents RPC
      const listReq = { jsonrpc: "2.0" as const, id: 2, method: "listAgents", params: {} };
      const listRes = await daemon.handleRpcCall(listReq);
      expect(listRes.error).toBeUndefined();
      const rpcAgentInList = (listRes.result as any[]).find((a: any) => a.name === "RpcAgent");
      expect(rpcAgentInList).toBeDefined();
      expect(rpcAgentInList.model).toBe("claude-3-7-sonnet-20250219");

      // 3. updateAgent RPC
      const updateReq = {
        jsonrpc: "2.0" as const,
        id: 3,
        method: "updateAgent",
        params: {
          name: "RpcAgent",
          patch: {
            model: "deepseek-r1",
            temperature: 0.0,
          },
        },
      };
      const updateRes = await daemon.handleRpcCall(updateReq);
      expect(updateRes.error).toBeUndefined();
      expect((updateRes.result as any).config.model).toBe("deepseek-r1");

      // Verify config.json updated
      const updatedDiskConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      expect(updatedDiskConfig.model).toBe("deepseek-r1");
      expect(updatedDiskConfig.temperature).toBe(0.0);

      // 4. getAgent RPC
      const getReq = { jsonrpc: "2.0" as const, id: 4, method: "getAgent", params: { name: "RpcAgent" } };
      const getRes = await daemon.handleRpcCall(getReq);
      expect(getRes.error).toBeUndefined();
      expect((getRes.result as any).config.model).toBe("deepseek-r1");
      expect((getRes.result as any).prompts.identity).toContain("RPC agent prompt text");

      // 5. updateAgentContext RPC
      const updateCtxReq = {
        jsonrpc: "2.0" as const,
        id: 5,
        method: "updateAgentContext",
        params: {
          name: "RpcAgent",
          fileName: "SOUL.md",
          content: "Updated soul directives via RPC.",
        },
      };
      const updateCtxRes = await daemon.handleRpcCall(updateCtxReq);
      expect(updateCtxRes.error).toBeUndefined();

      const soulContent = fs.readFileSync(path.join(tempRoot, "agents", "RpcAgent", "SOUL.md"), "utf-8");
      expect(soulContent).toContain("Updated soul directives via RPC.");
    } finally {
      delete process.env.KRYPTON_HOME;
    }
  });
});
