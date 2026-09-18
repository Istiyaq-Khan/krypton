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
}

/**
 * Resolves the absolute directory path for an agent workspace.
 */
export function resolveAgentDir(
  agentDirOrName: string,
  options?: AgentStorageOptions
): { agentName: string; agentDir: string } {
  if (!agentDirOrName || !agentDirOrName.trim()) {
    throw new Error("Agent name or directory must be specified");
  }

  const trimmed = agentDirOrName.trim();
  if (path.isAbsolute(trimmed) || trimmed.includes("/") || trimmed.includes("\\")) {
    const resolved = path.resolve(trimmed);
    const agentName = path.basename(resolved);
    return { agentName, agentDir: resolved };
  }

  const kryptonHome = resolveKryptonHome(options?.customRoot);
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
  options?: AgentStorageOptions
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
  options?: AgentStorageOptions
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
  options?: AgentStorageOptions
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
  options?: AgentStorageOptions & { raw?: boolean }
): Promise<string> {
  const { agentDir } = resolveAgentDir(agentDirOrName, options);
  const filePath = path.join(agentDir, fileName);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  const content = await fs.promises.readFile(filePath, "utf-8");
  if (options?.raw) {
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
  options?: AgentStorageOptions
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
  };
  combinedSystemPrompt: string;
}

/**
 * Orchestrates loading an agent's complete operational context:
 * - Reads machine-readable settings from `config.json`.
 * - Reads pure instructions and domain knowledge from Markdown files.
 * - Assembles a clean, structured system prompt for LLM generation.
 */
export async function loadAgentContext(
  agentDirOrName: string,
  options?: AgentStorageOptions
): Promise<LoadedAgentContext> {
  const config = await readAgentConfig(agentDirOrName, options);

  const [identity, soul, agents, user, memory] = await Promise.all([
    readAgentContextMarkdown(agentDirOrName, "IDENTITY.md", options),
    readAgentContextMarkdown(agentDirOrName, "SOUL.md", options),
    readAgentContextMarkdown(agentDirOrName, "AGENTS.md", options),
    readAgentContextMarkdown(agentDirOrName, "USER.md", options),
    readAgentContextMarkdown(agentDirOrName, "MEMORY.md", options),
  ]);

  const promptSections: string[] = [];

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

  return {
    config,
    prompts: {
      identity,
      soul,
      agents,
      user,
      memory,
    },
    combinedSystemPrompt: promptSections.join("\n\n"),
  };
}
