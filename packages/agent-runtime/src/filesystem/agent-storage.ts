import * as fs from "node:fs";
import * as path from "node:path";
import {
  AgentConfigFile,
  AgentConfigFileSchema,
  createDefaultAgentConfig,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "./bootstrap.js";
import { parseMarkdownWithFrontmatter } from "./parser.js";

export interface AgentStorageOptions {
  customRoot?: string;
  raw?: boolean;
}

export type AgentStorageOptionsInput = AgentStorageOptions | string;

export function normalizeAgentStorageOptions(
  options?: AgentStorageOptionsInput
): AgentStorageOptions | undefined {
  if (typeof options === "string") {
    return { customRoot: options };
  }
  return options;
}

/**
 * Resolves the absolute directory path for an agent workspace.
 */
export function resolveAgentDir(
  agentDirOrName: string,
  options?: AgentStorageOptionsInput
): { agentName: string; agentDir: string } {
  const opts = normalizeAgentStorageOptions(options);
  if (!agentDirOrName || !agentDirOrName.trim()) {
    throw new Error("Agent name or directory must be specified");
  }

  const trimmed = agentDirOrName.trim();
  if (path.isAbsolute(trimmed) || trimmed.includes("/") || trimmed.includes("\\")) {
    const resolved = path.resolve(trimmed);
    const agentName = path.basename(resolved);
    return { agentName, agentDir: resolved };
  }

  const kryptonHome = resolveKryptonHome(opts?.customRoot);
  const agentDir = path.join(kryptonHome, "agents", trimmed);
  return { agentName: trimmed, agentDir };
}

/**
 * Strips any YAML frontmatter or leading comments from markdown context content.
 * Guarantees that only pure prompt/instruction text is returned for LLM context.
 */
export function stripMarkdownFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return trimmed;
  }

  const secondFence = trimmed.indexOf("---", 3);
  if (secondFence !== -1) {
    return trimmed.slice(secondFence + 3).trim();
  }

  return trimmed;
}

/**
 * Reads and validates the machine-readable `config.json` for an agent.
 * If `config.json` is missing or invalid, performs graceful self-healing and migration
 * by checking legacy files (such as IDENTITY.md or AGENTS.md) and creating a compliant config.json.
 */
export async function readAgentConfig(
  agentDirOrName: string,
  options?: AgentStorageOptionsInput
): Promise<AgentConfigFile> {
  const { agentName, agentDir } = resolveAgentDir(agentDirOrName, options);
  const configPath = path.join(agentDir, "config.json");

  if (fs.existsSync(configPath)) {
    try {
      const raw = await fs.promises.readFile(configPath, "utf-8");
      const parsedJson = JSON.parse(raw);
      const validation = AgentConfigFileSchema.safeParse(parsedJson);

      if (validation.success) {
        return validation.data;
      }

      // If missing some fields or older schema, heal with default values
      const healed = createDefaultAgentConfig(agentName, parsedJson);
      await writeAgentConfig(agentDir, healed, options);
      return healed;
    } catch {
      // Corrupt or unparseable config.json, fallback to self-healing migration
    }
  }

  // Self-healing & legacy migration:
  // Inspect legacy files if they exist in the agent directory
  let role = "Autonomous Desktop AI Agent";
  let model = "claude-3-7-sonnet-20250219";
  let provider = "anthropic";
  let temperature = 0.2;
  let tools = ["terminal", "filesystem", "astLinter"];
  let maxDepth = 3;

  const identityPath = path.join(agentDir, "IDENTITY.md");
  if (fs.existsSync(identityPath)) {
    try {
      const content = await fs.promises.readFile(identityPath, "utf-8");
      const parsed = parseMarkdownWithFrontmatter<{
        role?: string;
        model?: string;
        provider?: string;
        temperature?: number;
        tools?: string[];
      }>(content);
      if (parsed.frontmatter?.role) role = String(parsed.frontmatter.role);
      if (parsed.frontmatter?.model) model = String(parsed.frontmatter.model);
      if (parsed.frontmatter?.provider) provider = String(parsed.frontmatter.provider);
      if (typeof parsed.frontmatter?.temperature === "number") {
        temperature = parsed.frontmatter.temperature;
      }
      if (Array.isArray(parsed.frontmatter?.tools)) {
        tools = parsed.frontmatter.tools.map(String);
      }
    } catch {
      // Ignore legacy parse errors
    }
  }

  const agentsPath = path.join(agentDir, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    try {
      const content = await fs.promises.readFile(agentsPath, "utf-8");
      const parsed = parseMarkdownWithFrontmatter<{
        max_depth?: number;
        maxDepth?: number;
        allowedTools?: string[];
      }>(content);
      const md = parsed.frontmatter?.maxDepth ?? parsed.frontmatter?.max_depth;
      if (typeof md === "number") maxDepth = md;
      if (Array.isArray(parsed.frontmatter?.allowedTools)) {
        tools = parsed.frontmatter.allowedTools.map(String);
      }
    } catch {
      // Ignore legacy parse errors
    }
  }

  const initialConfig = createDefaultAgentConfig(agentName, {
    role,
    model,
    provider,
    temperature,
    tools,
    permissions: {
      allowedSubAgents: [],
      allowedTools: tools,
      maxDepth,
      maxConcurrentChildren: 5,
      budgetShare: 0.5,
      canSynthesizeTools: true,
      canAccessNetwork: true,
      canModifyWorkspace: true,
      terminal: tools.includes("terminal"),
      filesystem: tools.includes("filesystem"),
      web: tools.includes("web"),
      astLinter: tools.includes("astLinter"),
    },
  });

  if (!fs.existsSync(agentDir)) {
    await fs.promises.mkdir(agentDir, { recursive: true });
  }

  await writeAgentConfig(agentDir, initialConfig, options);
  return initialConfig;
}

/**
 * Writes the machine configuration strictly to `<agentDir>/config.json`.
 * Guaranteed to never modify or tamper with any Markdown context files.
 */
export async function writeAgentConfig(
  agentDirOrName: string,
  config: AgentConfigFile,
  options?: AgentStorageOptionsInput
): Promise<void> {
  const { agentDir } = resolveAgentDir(agentDirOrName, options);

  if (!fs.existsSync(agentDir)) {
    await fs.promises.mkdir(agentDir, { recursive: true });
  }

  const validated = AgentConfigFileSchema.parse(config);
  const configPath = path.join(agentDir, "config.json");
  await fs.promises.writeFile(
    configPath,
    JSON.stringify(validated, null, 2),
    "utf-8"
  );
}

/**
 * Updates agent configuration attributes and saves strictly to `<agentDir>/config.json`.
 * Leaves all Markdown prompt and context files intact.
 */
export async function updateAgentConfig(
  agentDirOrName: string,
  patch: Partial<AgentConfigFile>,
  options?: AgentStorageOptionsInput
): Promise<AgentConfigFile> {
  const existing = await readAgentConfig(agentDirOrName, options);

  const updated: AgentConfigFile = {
    ...existing,
    ...patch,
    permissions: {
      ...existing.permissions,
      ...(patch.permissions || {}),
    },
    budget: {
      ...existing.budget,
      ...(patch.budget || {}),
    },
    metadata: {
      ...existing.metadata,
      ...(patch.metadata || {}),
    },
    updatedAt: Date.now(),
  };

  await writeAgentConfig(agentDirOrName, updated, options);
  return updated;
}

/**
 * Reads pure markdown context from `<agentDir>/<fileName>`.
 * Strips any legacy YAML frontmatter so the LLM prompt assembler receives
 * exclusively clean prompt instruction and knowledge text.
 */
export async function readAgentContextMarkdown(
  agentDirOrName: string,
  fileName: string,
  options?: AgentStorageOptionsInput & { raw?: boolean }
): Promise<string> {
  const opts = normalizeAgentStorageOptions(options);
  const { agentDir } = resolveAgentDir(agentDirOrName, opts);
  let filePath = path.join(agentDir, fileName);

  if (!fs.existsSync(filePath)) {
    // Cross-platform case fallback (e.g. BOOTSTRAP.md <-> bootstrap.md)
    const altName =
      fileName === "BOOTSTRAP.md"
        ? "bootstrap.md"
        : fileName === "bootstrap.md"
          ? "BOOTSTRAP.md"
          : null;
    if (altName && fs.existsSync(path.join(agentDir, altName))) {
      filePath = path.join(agentDir, altName);
    } else {
      return "";
    }
  }

  const content = await fs.promises.readFile(filePath, "utf-8");
  const rawFlag = typeof options === "object" && options ? (options as any).raw : false;
  if (rawFlag) {
    return content;
  }

  return stripMarkdownFrontmatter(content);
}

/**
 * Persists pure markdown context into `<agentDir>/<fileName>`.
 * Enforces that markdown files are dedicated strictly to instructions and context,
 * without modifying `config.json`.
 */
export async function writeAgentContextMarkdown(
  agentDirOrName: string,
  fileName: string,
  content: string,
  options?: AgentStorageOptionsInput
): Promise<void> {
  const { agentDir } = resolveAgentDir(agentDirOrName, options);

  if (!fs.existsSync(agentDir)) {
    await fs.promises.mkdir(agentDir, { recursive: true });
  }

  const filePath = path.join(agentDir, fileName);
  await fs.promises.writeFile(filePath, content.trim() + "\n", "utf-8");
}

export interface LoadedAgentContext {
  config: AgentConfigFile;
  prompts: {
    identity: string;
    soul: string;
    agents: string;
    user: string;
    memory: string;
    bootstrap?: string;
  };
  bootstrapPrompt?: string;
  bootstrapDirectives?: string;
  combinedSystemPrompt: string;
  hasBootstrap: boolean;
}

/**
 * Orchestrates loading an agent's complete operational context:
 * - Reads machine-readable settings from `config.json`.
 * - Reads pure instructions and domain knowledge from Markdown files.
 * - Injects BOOTSTRAP.md when present with explicit agent-governed deletion instructions.
 * - Assembles a clean, structured system prompt for LLM generation.
 */
export async function loadAgentContext(
  agentDirOrName: string,
  options?: AgentStorageOptionsInput
): Promise<LoadedAgentContext> {
  const opts = normalizeAgentStorageOptions(options);
  const { agentDir } = resolveAgentDir(agentDirOrName, opts);
  const config = await readAgentConfig(agentDirOrName, opts);

  const [identity, soul, agents, user, memory, bootstrap] = await Promise.all([
    readAgentContextMarkdown(agentDirOrName, "IDENTITY.md", opts),
    readAgentContextMarkdown(agentDirOrName, "SOUL.md", opts),
    readAgentContextMarkdown(agentDirOrName, "AGENTS.md", opts),
    readAgentContextMarkdown(agentDirOrName, "USER.md", opts),
    readAgentContextMarkdown(agentDirOrName, "MEMORY.md", opts),
    readAgentContextMarkdown(agentDirOrName, "BOOTSTRAP.md", opts),
  ]);

  const promptSections: string[] = [];

  const kryptonHome = resolveKryptonHome(opts?.customRoot);
  const systemMdPath = path.join(kryptonHome, "system.md");
  if (fs.existsSync(systemMdPath)) {
    try {
      const rawSystem = fs.readFileSync(systemMdPath, "utf-8");
      const parsedSystem = parseMarkdownWithFrontmatter(rawSystem).body.trim();
      if (parsedSystem) {
        promptSections.push(parsedSystem);
      }
    } catch {
      // Ignore read errors
    }
  }

  const rootAgentMdPath = path.join(kryptonHome, "agents", "root.md");
  if (
    fs.existsSync(rootAgentMdPath) &&
    (agentDirOrName.toLowerCase() === "root" ||
      agentDirOrName.toLowerCase() === "orchestrator" ||
      !identity.trim())
  ) {
    try {
      const rawRootAgent = fs.readFileSync(rootAgentMdPath, "utf-8");
      const parsedRoot = parseMarkdownWithFrontmatter(rawRootAgent).body.trim();
      if (parsedRoot) {
        promptSections.push(parsedRoot);
      }
    } catch {
      // Ignore read errors
    }
  }

  if (identity.trim()) {
    promptSections.push(identity.trim());
  }
  if (soul.trim()) {
    promptSections.push(`## Core Directives & Behavioral Guardrails\n${soul.trim()}`);
  }
  if (agents.trim()) {
    promptSections.push(`## Workspace Conventions & Operational Directives\n${agents.trim()}`);
  }
  if (user.trim()) {
    promptSections.push(`## User Preferences & Directives\n${user.trim()}`);
  }

  const hasBootstrap = Boolean(bootstrap && bootstrap.trim().length > 0);
  let bootstrapDirectives: string | undefined;
  if (hasBootstrap) {
    bootstrapDirectives = [
      "=================================================================",
      "CRITICAL ONBOARDING DIRECTIVE: ACTIVE BOOTSTRAP PROTOCOL DETECTED",
      "=================================================================",
      `A pending initialization file exists in the active workspace at: ${path.join(agentDir, "BOOTSTRAP.md")}`,
      "",
      "FILE CONTENT:",
      bootstrap.trim(),
      "",
      "OPERATIONAL RULES FOR BOOTSTRAP:",
      "1. You MUST execute, configure, or initialize any setup tasks listed in this file.",
      "2. Krypton will NEVER automatically delete this file.",
      "3. You alone are responsible for removing this file using file deletion tools once setup and verification are complete.",
      "=================================================================",
    ].join("\n");
    promptSections.push(bootstrapDirectives);
  }

  return {
    config,
    prompts: {
      identity,
      soul,
      agents,
      user,
      memory,
      ...(hasBootstrap ? { bootstrap: bootstrap.trim() } : {}),
    },
    bootstrapPrompt: hasBootstrap ? bootstrap.trim() : undefined,
    bootstrapDirectives,
    combinedSystemPrompt: promptSections.join("\n\n"),
    hasBootstrap,
  };
}

/**
 * Removes BOOTSTRAP.md or bootstrap.md from the agent workspace.
 * Invoked strictly when the agent issues a verified file tool execution to remove the file.
 * The system never executes this automatically.
 */
export async function deleteBootstrapFile(
  agentDirOrName: string,
  options?: AgentStorageOptionsInput
): Promise<boolean> {
  const opts = normalizeAgentStorageOptions(options);
  const { agentDir } = resolveAgentDir(agentDirOrName, opts);
  const targets = ["BOOTSTRAP.md", "bootstrap.md"];
  let deleted = false;

  for (const file of targets) {
    const filePath = path.join(agentDir, file);
    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
        deleted = true;
      } catch {
        // Failed to unlink target
      }
    }
  }

  return deleted;
}

/**
 * Safely deletes an agent workspace directory under ~/.krypton/agents/<agentName>.
 * Guards against root deletion and path traversal attacks.
 */
export async function deleteAgentWorkspace(
  agentDirOrName: string,
  options?: AgentStorageOptionsInput
): Promise<boolean> {
  const opts = normalizeAgentStorageOptions(options);
  const { agentName, agentDir } = resolveAgentDir(agentDirOrName, opts);

  const trimmed = agentName.trim().toLowerCase();
  if (trimmed === "agent-root" || trimmed === "root" || trimmed === "orchestrator") {
    throw new Error(`Cannot delete protected root agent workspace: ${agentName}`);
  }

  const kryptonHome = resolveKryptonHome(opts?.customRoot);
  const agentsRoot = path.join(kryptonHome, "agents");
  const normalizedTarget = path.resolve(agentDir);
  const normalizedAgentsRoot = path.resolve(agentsRoot);

  if (!normalizedTarget.startsWith(normalizedAgentsRoot + path.sep)) {
    throw new Error(`Path traversal violation: ${agentDir} is outside agents directory`);
  }

  if (fs.existsSync(normalizedTarget)) {
    await fs.promises.rm(normalizedTarget, { recursive: true, force: true });
    return true;
  }

  return false;
}

