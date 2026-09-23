import * as fs from "node:fs";
import * as path from "node:path";
import { resolveKryptonHome } from "./bootstrap.js";
import { parseMarkdownWithFrontmatter } from "./parser.js";

export interface PromptCompilerOptions {
  agentName?: string;
  customRoot?: string;
  workspacePath?: string;
  additionalDirectives?: string;
  includeBootstrap?: boolean;
}

/**
 * Strips YAML frontmatter from markdown text if present, returning the clean body.
 */
export function stripFrontmatter(content: string): string {
  if (!content) return "";
  const parsed = parseMarkdownWithFrontmatter(content);
  return parsed.body.trim();
}

/**
 * Asynchronously compiles the file-driven system prompt for an agent.
 * Strictly and exclusively uses:
 * 1. Root System Directives: ~/.krypton/system.md
 * 2. Root/Agent Profile: ~/.krypton/agents/<agentName>.md or fallback to ~/.krypton/agents/root.md
 * 3. Active Bootstrap Protocol: BOOTSTRAP.md (if present during onboarding)
 * 4. Dynamic / Runtime Additional Directives (if supplied)
 *
 * All legacy multi-file directory structures (IDENTITY.md, SOUL.md, AGENTS.md, USER.md, MEMORY.md)
 * are completely omitted from prompt assembly.
 */
export async function compileSystemPrompt(
  options: PromptCompilerOptions = {}
): Promise<string> {
  const kryptonHome = resolveKryptonHome(options.customRoot);
  const agentName = (options.agentName || "Orchestrator").trim();
  const includeBootstrap = options.includeBootstrap !== false;

  const sections: string[] = [];

  // 1. Root system instructions (~/.krypton/system.md)
  const systemMdPath = path.join(kryptonHome, "system.md");
  if (fs.existsSync(systemMdPath)) {
    try {
      const raw = await fs.promises.readFile(systemMdPath, "utf-8");
      const clean = stripFrontmatter(raw);
      if (clean) {
        sections.push(clean);
      }
    } catch {
      // Ignore read errors gracefully
    }
  }

  // 2. Single-file agent markdown (~/.krypton/agents/<agentName>.md or fallback to ~/.krypton/agents/root.md)
  const agentSpecificMdPath = path.join(kryptonHome, "agents", `${agentName}.md`);
  const rootAgentMdPath = path.join(kryptonHome, "agents", "root.md");

  if (fs.existsSync(agentSpecificMdPath)) {
    try {
      const raw = await fs.promises.readFile(agentSpecificMdPath, "utf-8");
      const clean = stripFrontmatter(raw);
      if (clean) {
        sections.push(clean);
      }
    } catch {
      // Ignore read errors
    }
  } else if (fs.existsSync(rootAgentMdPath)) {
    try {
      const raw = await fs.promises.readFile(rootAgentMdPath, "utf-8");
      const clean = stripFrontmatter(raw);
      if (clean) {
        sections.push(clean);
      }
    } catch {
      // Ignore read errors
    }
  }

  // 3. Pending Onboarding Ritual (BOOTSTRAP.md)
  if (includeBootstrap) {
    let bootstrapCandidatePath: string | null = null;
    let bootstrapContent = "";

    const candidatesToCheck: string[] = [];
    if (options.workspacePath && fs.existsSync(options.workspacePath)) {
      candidatesToCheck.push(
        path.join(options.workspacePath, "BOOTSTRAP.md"),
        path.join(options.workspacePath, "bootstrap.md")
      );
    }
    const agentDir = path.join(kryptonHome, "agents", agentName);
    candidatesToCheck.push(
      path.join(agentDir, "BOOTSTRAP.md"),
      path.join(agentDir, "bootstrap.md")
    );

    for (const cand of candidatesToCheck) {
      if (fs.existsSync(cand)) {
        try {
          const raw = await fs.promises.readFile(cand, "utf-8");
          const trimmed = raw.trim();
          if (trimmed.length > 0) {
            bootstrapCandidatePath = cand;
            bootstrapContent = trimmed;
            break;
          }
        } catch {
          // Continue to next candidate
        }
      }
    }

    if (bootstrapCandidatePath && bootstrapContent) {
      const bootstrapDirectives = [
        "=================================================================",
        "CRITICAL ONBOARDING DIRECTIVE: ACTIVE BOOTSTRAP PROTOCOL DETECTED",
        "=================================================================",
        `A pending initialization file exists in the active workspace at: ${bootstrapCandidatePath}`,
        "",
        "FILE CONTENT:",
        bootstrapContent,
        "",
        "OPERATIONAL RULES FOR BOOTSTRAP:",
        "1. You MUST execute, configure, or initialize any setup tasks listed in this file.",
        "2. Krypton will NEVER automatically delete this file.",
        "3. You alone are responsible for removing this file using file deletion tools once setup and verification are complete.",
        "=================================================================",
      ].join("\n");

      sections.push(bootstrapDirectives);
    }
  }

  // 4. Additional directives if supplied
  if (options.additionalDirectives && options.additionalDirectives.trim()) {
    sections.push(options.additionalDirectives.trim());
  }

  return sections.join("\n\n");
}
