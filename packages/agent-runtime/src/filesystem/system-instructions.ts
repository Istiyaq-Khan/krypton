import * as fs from "node:fs";
import * as path from "node:path";
import {
  ReadSystemInstructionsInput,
  ReadSystemInstructionsInputSchema,
  UpdateSystemInstructionsInput,
  UpdateSystemInstructionsInputSchema,
  SystemInstructionResult,
  SystemInstructionResultSchema,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "./bootstrap.js";

export interface SystemInstructionOptions {
  customRoot?: string;
  agentName?: string;
}

/**
 * Resolves and validates a target markdown path within ~/.krypton,
 * strictly defending against path traversal, symlink attacks, and non-markdown targets.
 */
export function resolveValidatedInstructionPath(
  targetFile: string,
  options: SystemInstructionOptions = {}
): { resolvedPath: string; relativeTarget: string } {
  if (!targetFile || typeof targetFile !== "string" || targetFile.trim().length === 0) {
    throw new Error("Target instruction file path must be specified");
  }

  // Null byte injection check
  if (targetFile.includes("\0")) {
    throw new Error("Invalid target file path: null bytes are prohibited");
  }

  const kryptonHome = path.resolve(resolveKryptonHome(options.customRoot));
  const rawTarget = targetFile.trim().replace(/\\/g, "/");

  // Disallow absolute drive/root escapes
  if (path.isAbsolute(rawTarget)) {
    const normalized = path.resolve(rawTarget);
    if (!normalized.startsWith(kryptonHome)) {
      throw new Error(`Path traversal denied: path '${targetFile}' is outside Krypton home`);
    }
  }

  // Handle shorthands: if targetFile is just a filename like "system.md" or "root.md"
  let relativeTarget = rawTarget;
  if (relativeTarget.startsWith("./")) {
    relativeTarget = relativeTarget.slice(2);
  }

  let resolvedPath = path.resolve(kryptonHome, relativeTarget);

  // If agentName provided and user requested an agent file like "root.md" without "agents/"
  if (
    options.agentName &&
    !relativeTarget.startsWith("agents/") &&
    ["root.md", "bootstrap.md"].includes(relativeTarget.toLowerCase())
  ) {
    resolvedPath = path.resolve(kryptonHome, "agents", relativeTarget);
  }

  // Strict boundary check against path traversal
  const relativeFromHome = path.relative(kryptonHome, resolvedPath);
  if (
    relativeFromHome.startsWith("..") ||
    path.isAbsolute(relativeFromHome) ||
    !resolvedPath.startsWith(kryptonHome)
  ) {
    throw new Error(`Security Violation: Path traversal detected outside ~/.krypton ('${targetFile}')`);
  }

  // Enforce .md extension strictly
  if (path.extname(resolvedPath).toLowerCase() !== ".md") {
    throw new Error(
      `Security Violation: System instruction targets must have a '.md' extension. Refused: '${targetFile}'`
    );
  }

  return { resolvedPath, relativeTarget };
}

/**
 * Safely reads a system instruction Markdown file within ~/.krypton.
 */
export async function readSystemInstructions(
  rawInput: ReadSystemInstructionsInput | string = "system.md",
  options: SystemInstructionOptions = {}
): Promise<SystemInstructionResult> {
  const inputObj =
    typeof rawInput === "string" ? { targetFile: rawInput } : rawInput;
  const validatedInput = ReadSystemInstructionsInputSchema.parse(inputObj);

  try {
    const { resolvedPath, relativeTarget } = resolveValidatedInstructionPath(
      validatedInput.targetFile,
      options
    );

    if (!fs.existsSync(resolvedPath)) {
      return SystemInstructionResultSchema.parse({
        success: false,
        targetFile: relativeTarget,
        message: `System instruction file not found: ${relativeTarget}`,
      });
    }

    const content = await fs.promises.readFile(resolvedPath, "utf-8");

    return SystemInstructionResultSchema.parse({
      success: true,
      targetFile: relativeTarget,
      content,
      bytesWritten: 0,
      message: `Successfully read system instructions from ${relativeTarget}`,
    });
  } catch (err: any) {
    return SystemInstructionResultSchema.parse({
      success: false,
      targetFile: validatedInput.targetFile,
      message: `Failed to read system instructions: ${err?.message || String(err)}`,
    });
  }
}

/**
 * Safely updates or appends to a system instruction Markdown file within ~/.krypton
 * using atomic temporary writes and path validation.
 */
export async function updateSystemInstructions(
  rawInput: UpdateSystemInstructionsInput,
  options: SystemInstructionOptions = {}
): Promise<SystemInstructionResult> {
  const validatedInput = UpdateSystemInstructionsInputSchema.parse(rawInput);

  try {
    const { resolvedPath, relativeTarget } = resolveValidatedInstructionPath(
      validatedInput.targetFile,
      options
    );

    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    let finalContent = validatedInput.content;
    const isAppend = validatedInput.mode === "append";

    if (isAppend && fs.existsSync(resolvedPath)) {
      const existing = await fs.promises.readFile(resolvedPath, "utf-8");
      const trimmedExisting = existing.trim();
      finalContent = trimmedExisting
        ? `${trimmedExisting}\n\n${validatedInput.content.trim()}\n`
        : `${validatedInput.content.trim()}\n`;
    } else {
      finalContent = `${validatedInput.content.trim()}\n`;
    }

    // Atomic write via temporary file
    const tmpFileName = `.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.md`;
    const tmpPath = path.join(dir, tmpFileName);

    await fs.promises.writeFile(tmpPath, finalContent, "utf-8");
    await fs.promises.rename(tmpPath, resolvedPath);

    const bytesWritten = Buffer.byteLength(finalContent, "utf-8");

    return SystemInstructionResultSchema.parse({
      success: true,
      targetFile: relativeTarget,
      bytesWritten,
      message: `Successfully ${isAppend ? "appended to" : "updated"} ${relativeTarget}`,
    });
  } catch (err: any) {
    return SystemInstructionResultSchema.parse({
      success: false,
      targetFile: validatedInput.targetFile,
      message: `Failed to update system instructions: ${err?.message || String(err)}`,
    });
  }
}

/**
 * Registers read_system_instructions and update_system_instructions into the MCP ToolRegistry.
 */
export function registerSystemInstructionTools(
  registry: {
    registerBuiltinTool: (
      tool: any,
      executor: (params: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }>
    ) => void;
  },
  options: SystemInstructionOptions = {}
): void {
  registry.registerBuiltinTool(
    {
      name: "read_system_instructions",
      description:
        "Safely reads markdown system instructions or agent directives from ~/.krypton/ (e.g., 'system.md', 'agents/root.md').",
      inputSchema: {
        type: "object",
        properties: {
          targetFile: {
            type: "string",
            description: "Target markdown file path within ~/.krypton (defaults to 'system.md')",
          },
        },
        required: [],
      },
    },
    async (params) => {
      const targetFile = String(params.targetFile || "system.md");
      const res = await readSystemInstructions(targetFile, options);
      return {
        content: res.content || res.message,
        isError: !res.success,
      };
    }
  );

  registry.registerBuiltinTool(
    {
      name: "update_system_instructions",
      description:
        "Safely updates or appends to a markdown system instruction file within ~/.krypton with atomic writes and path safety.",
      inputSchema: {
        type: "object",
        properties: {
          targetFile: {
            type: "string",
            description: "Target markdown file within ~/.krypton (e.g., 'system.md', 'agents/root.md')",
          },
          content: {
            type: "string",
            description: "Markdown instructions to write or append",
          },
          mode: {
            type: "string",
            enum: ["overwrite", "append"],
            description: "Write mode: 'overwrite' to replace content, or 'append' to add to existing file",
          },
        },
        required: ["targetFile", "content"],
      },
    },
    async (params) => {
      const targetFile = String(params.targetFile || "system.md");
      const content = String(params.content || "");
      const mode = (params.mode === "append" ? "append" : "overwrite") as "overwrite" | "append";

      const res = await updateSystemInstructions({ targetFile, content, mode }, options);
      return {
        content: res.message,
        isError: !res.success,
      };
    }
  );
}
