import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorktreeContext, WorktreeContextSchema } from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

const execFileAsync = promisify(execFile);

export interface GitExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Safely executes git CLI binary with arguments array to eliminate shell injection vulnerabilities.
 */
export async function runGit(args: string[], cwd: string): Promise<GitExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: any) {
    const stdout = err.stdout ? String(err.stdout).trim() : "";
    const stderr = err.stderr ? String(err.stderr).trim() : err.message;
    throw new Error(`Git command 'git ${args.join(" ")}' failed in '${cwd}':\n${stderr}\n${stdout}`);
  }
}

export interface CreateWorktreeOptions {
  taskId: string;
  targetRepoPath: string;
  baseRef?: string;
  customRoot?: string;
}

/**
 * Manages isolated Git worktrees under ~/.krypton/worktrees/<task-id>.
 * Guarantees agent modifications never dirty the user's active branch or working tree.
 */
export class WorktreeManager {
  private readonly customRoot?: string;

  constructor(options?: { customRoot?: string }) {
    this.customRoot = options?.customRoot;
  }

  /**
   * Validates target repository and verifies it has an initialized git tree.
   */
  public async getBaseCommit(targetRepoPath: string, ref = "HEAD"): Promise<string> {
    const result = await runGit(["rev-parse", ref], targetRepoPath);
    return result.stdout;
  }

  /**
   * Creates an isolated worktree under ~/.krypton/worktrees/<task-id> on branch krypton/<task-id>.
   */
  public async createWorktree(options: CreateWorktreeOptions): Promise<WorktreeContext> {
    const home = resolveKryptonHome(options.customRoot ?? this.customRoot);
    const worktreesDir = path.join(home, "worktrees");
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    const worktreePath = path.join(worktreesDir, options.taskId);
    const branchName = `krypton/${options.taskId}`;

    // Ensure base commit exists
    const baseCommitHash = await this.getBaseCommit(
      options.targetRepoPath,
      options.baseRef ?? "HEAD"
    );

    // If destination folder already exists, remove it first
    if (fs.existsSync(worktreePath)) {
      try {
        await runGit(["worktree", "remove", "--force", worktreePath], options.targetRepoPath);
      } catch {
        // Fallback disk cleanup
        await fs.promises.rm(worktreePath, { recursive: true, force: true });
      }
    }

    // Create isolated worktree with dedicated task branch
    try {
      await runGit(
        ["worktree", "add", "-b", branchName, worktreePath, baseCommitHash],
        options.targetRepoPath
      );
    } catch (err: any) {
      // If branch already existed from previous run, try worktree add without -b or reset it
      if (err.message.includes("already exists")) {
        await runGit(["branch", "-D", branchName], options.targetRepoPath).catch(() => {});
        await runGit(
          ["worktree", "add", "-b", branchName, worktreePath, baseCommitHash],
          options.targetRepoPath
        );
      } else {
        throw err;
      }
    }

    const context: WorktreeContext = WorktreeContextSchema.parse({
      taskId: options.taskId,
      targetRepoPath: path.resolve(options.targetRepoPath),
      worktreePath: path.resolve(worktreePath),
      baseCommitHash,
      branchName,
      status: "active",
      createdAt: Date.now(),
    });

    return context;
  }

  /**
   * Safely unregisters and removes the isolated worktree.
   */
  public async removeWorktree(
    context: WorktreeContext,
    options?: { force?: boolean; deleteBranch?: boolean }
  ): Promise<void> {
    const force = options?.force ?? true;
    const worktreePath = context.worktreePath;

    if (fs.existsSync(worktreePath)) {
      try {
        const args = ["worktree", "remove"];
        if (force) args.push("--force");
        args.push(worktreePath);
        await runGit(args, context.targetRepoPath);
      } catch {
        await fs.promises.rm(worktreePath, { recursive: true, force: true });
      }
    }

    if (options?.deleteBranch) {
      try {
        await runGit(["branch", "-D", context.branchName], context.targetRepoPath);
      } catch {
        // Ignore if branch was already deleted or merged
      }
    }

    await this.prune(context.targetRepoPath);
  }

  /**
   * Runs git worktree prune on the target repository.
   */
  public async prune(targetRepoPath: string): Promise<void> {
    try {
      await runGit(["worktree", "prune"], targetRepoPath);
    } catch {
      // Ignore prune errors
    }
  }
}
