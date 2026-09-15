import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ToolExecutionResult } from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

export interface SandboxExecutionOptions {
  requestId?: string;
  toolName: string;
  language: "python" | "typescript" | "javascript" | "shell";
  code: string;
  timeoutMs?: number;
  customRoot?: string;
  env?: Record<string, string>;
  maxOutputBytes?: number;
}

/**
 * Kills a process and all its children across Windows and POSIX.
 */
export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      child_process.execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Process may already be dead
    }
  } else {
    try {
      // Kill entire process group
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Already terminated
      }
    }
  }
}

/**
 * Executes synthesized code inside an isolated ephemeral subprocess workspace.
 */
export class SandboxRunner {
  private readonly sandboxWorkspaceRoot: string;

  constructor(customRoot?: string) {
    const kryptonHome = resolveKryptonHome(customRoot);
    this.sandboxWorkspaceRoot = path.join(kryptonHome, "sandbox_workspace");
    if (!fs.existsSync(this.sandboxWorkspaceRoot)) {
      fs.mkdirSync(this.sandboxWorkspaceRoot, { recursive: true });
    }
  }

  public async execute(options: SandboxExecutionOptions): Promise<ToolExecutionResult> {
    const requestId = options.requestId || crypto.randomUUID();
    const execId = `exec_${Date.now()}_${requestId.slice(0, 8)}`;
    const workspaceDir = path.join(this.sandboxWorkspaceRoot, execId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    const timeoutMs = options.timeoutMs ?? 30_000;
    const maxOutputBytes = options.maxOutputBytes ?? 512 * 1024; // 512KB cap
    const startTime = Date.now();

    // 1. Write the source code file
    const ext = options.language === "python" ? "py" : options.language === "typescript" ? "ts" : "js";
    const scriptFile = path.join(workspaceDir, `script.${ext}`);
    fs.writeFileSync(scriptFile, options.code, "utf-8");

    // 2. Determine command & args
    let cmd: string;
    let args: string[];

    if (options.language === "python") {
      cmd = process.platform === "win32" ? "python" : "python3";
      args = [scriptFile];
    } else if (options.language === "typescript") {
      cmd = "node";
      args = ["--loader", "ts-node/esm", scriptFile];
    } else {
      cmd = "node";
      args = [scriptFile];
    }

    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let isError = false;
    let timedOut = false;

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = child_process.spawn(cmd, args, {
          cwd: workspaceDir,
          env: {
            ...process.env,
            ...options.env,
            KRYPTON_SANDBOX: "true",
            KRYPTON_WORKSPACE: workspaceDir,
          },
          detached: process.platform !== "win32",
        });

        const timer = setTimeout(() => {
          timedOut = true;
          if (proc.pid) {
            killProcessTree(proc.pid);
          }
          stderr += `\nExecution timed out after ${timeoutMs}ms`;
          isError = true;
          exitCode = -1;
          resolve();
        }, timeoutMs);

        proc.stdout?.on("data", (chunk: Buffer) => {
          if (stdout.length < maxOutputBytes) {
            stdout += chunk.toString("utf-8");
          }
        });

        proc.stderr?.on("data", (chunk: Buffer) => {
          if (stderr.length < maxOutputBytes) {
            stderr += chunk.toString("utf-8");
          }
        });

        proc.on("error", (err) => {
          clearTimeout(timer);
          isError = true;
          stderr += `\nFailed to start process: ${err.message}`;
          exitCode = 1;
          resolve();
        });

        proc.on("close", (code) => {
          clearTimeout(timer);
          if (!timedOut) {
            exitCode = code ?? 0;
            isError = exitCode !== 0;
          }
          resolve();
        });
      });
    } finally {
      // Clean up workspace after execution
      try {
        if (fs.existsSync(workspaceDir)) {
          fs.rmSync(workspaceDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      requestId,
      toolName: options.toolName,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      durationMs,
      isError,
      outputOffloaded: false,
    };
  }
}
