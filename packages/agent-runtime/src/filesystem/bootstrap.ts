import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { GlobalConfigSchema } from "@krypton/shared-types";
import { loadAgentArchetype } from "./template-loader.js";

export interface BootstrapOptions {
  customRoot?: string;
  forceReset?: boolean;
  defaultAgentName?: string;
}

export interface AgentWorkspaceResult {
  agentName: string;
  agentDir: string;
  filesCreated: string[];
  directoriesCreated: string[];
}

export interface BootstrapResult {
  kryptonHome: string;
  directoriesCreated: string[];
  filesCreated: string[];
  defaultAgent?: AgentWorkspaceResult;
}

/**
 * Resolves the platform-specific Krypton runtime home directory.
 * Priority: customRoot > KRYPTON_HOME env > OS home (~/.krypton)
 */
export function resolveKryptonHome(customRoot?: string): string {
  if (customRoot) {
    return path.resolve(customRoot);
  }
  if (process.env.KRYPTON_HOME) {
    return path.resolve(process.env.KRYPTON_HOME);
  }

  const home =
    process.platform === "win32"
      ? process.env.USERPROFILE || os.homedir()
      : process.env.HOME || os.homedir();

  return path.join(home, ".krypton");
}

/**
 * Dynamically provisions an isolated workspace directory for a named agent
 * using the universal agent archetype templates.
 */
export async function bootstrapAgentWorkspace(
  agentName: string,
  options: BootstrapOptions = {}
): Promise<AgentWorkspaceResult> {
  if (!agentName || !agentName.trim()) {
    throw new Error("Agent name must be specified to bootstrap workspace");
  }

  const sanitizedName = agentName.trim();
  const kryptonHome = resolveKryptonHome(options.customRoot);
  const agentDir = path.join(kryptonHome, "agents", sanitizedName);
  const trajectoriesDir = path.join(agentDir, "short_term", "trajectories");

  const directoriesCreated: string[] = [];
  const filesCreated: string[] = [];

  for (const dir of [agentDir, trajectoriesDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      directoriesCreated.push(dir);
    }
  }

  // Load archetype files with substituted placeholders
  const archetype = await loadAgentArchetype(sanitizedName);

  for (const [fileName, content] of Object.entries(archetype)) {
    const filePath = path.join(agentDir, fileName);
    if (!fs.existsSync(filePath) || options.forceReset) {
      fs.writeFileSync(filePath, content, "utf-8");
      filesCreated.push(filePath);
    }
  }

  return {
    agentName: sanitizedName,
    agentDir,
    filesCreated,
    directoriesCreated,
  };
}

/**
 * Provisions the ~/.krypton system folder structure and root configuration.
 * Does not hardcode any default agent; provisions agent workspace only if defaultAgentName is given.
 */
export async function bootstrapKryptonHome(
  options: BootstrapOptions = {}
): Promise<BootstrapResult> {
  const kryptonHome = resolveKryptonHome(options.customRoot);

  const requiredDirectories = [
    "",
    "cache/outputs",
    "pty_sessions",
    "telemetry",
    "agents",
    "worktrees",
    "tools/python",
    "tools/typescript",
    "browser_profiles/default",
    "logs",
    "sandbox_workspace",
  ];

  const directoriesCreated: string[] = [];
  const filesCreated: string[] = [];

  for (const relDir of requiredDirectories) {
    const targetDir = path.join(kryptonHome, relDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      directoriesCreated.push(targetDir);
    }
  }

  // 1. Global config.json
  const configPath = path.join(kryptonHome, "config.json");
  if (!fs.existsSync(configPath) || options.forceReset) {
    const defaultConfig = GlobalConfigSchema.parse({});
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
    filesCreated.push(configPath);
  }

  // 2. Credentials placeholder
  const credsPath = path.join(kryptonHome, "credentials.enc");
  if (!fs.existsSync(credsPath)) {
    fs.writeFileSync(credsPath, "", "utf-8");
    filesCreated.push(credsPath);
  }

  // 3. Optional default agent workspace if specified
  let defaultAgent: AgentWorkspaceResult | undefined;
  if (options.defaultAgentName) {
    defaultAgent = await bootstrapAgentWorkspace(options.defaultAgentName, options);
  }

  return {
    kryptonHome,
    directoriesCreated,
    filesCreated,
    defaultAgent,
  };
}
