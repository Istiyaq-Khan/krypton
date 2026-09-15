import {
  ConventionalCommitType,
  ConventionalCommitTypeSchema,
  SemanticCommitMeta,
  SemanticCommitMetaSchema,
} from "@krypton/shared-types";
import { runGit } from "./worktree.js";

export interface CreateCommitOptions {
  worktreePath: string;
  taskId: string;
  stepIndex: number;
  type?: ConventionalCommitType;
  scope?: string;
  description: string;
  body?: string;
}

/**
 * Autonomous Commit Generator (Krypton-VCS)
 * Automatically stages changes (git add -A) after completed task steps,
 * generates semantic Conventional Commit messages, and commits changes into the worktree branch.
 */
export class AutonomousCommitGenerator {
  /**
   * Checks if there are unstaged or staged modifications in the worktree.
   */
  public async hasChanges(worktreePath: string): Promise<boolean> {
    const status = await runGit(["status", "--porcelain"], worktreePath);
    return status.stdout.length > 0;
  }

  /**
   * Infers a Conventional Commit type from task description or changed files if not explicitly provided.
   */
  public inferCommitType(description: string): ConventionalCommitType {
    const lower = description.toLowerCase();
    if (lower.startsWith("fix") || lower.includes("bug") || lower.includes("error")) {
      return "fix";
    }
    if (lower.startsWith("refactor") || lower.includes("cleanup")) {
      return "refactor";
    }
    if (lower.startsWith("test") || lower.includes("unit test")) {
      return "test";
    }
    if (lower.startsWith("doc") || lower.includes("readme")) {
      return "docs";
    }
    if (lower.startsWith("perf") || lower.includes("optimize")) {
      return "perf";
    }
    if (lower.startsWith("build") || lower.includes("dep")) {
      return "build";
    }
    return "feat";
  }

  /**
   * Stages all changes and produces an atomic Conventional Commit.
   */
  public async commitStep(options: CreateCommitOptions): Promise<SemanticCommitMeta | null> {
    const hasChanges = await this.hasChanges(options.worktreePath);
    if (!hasChanges) {
      return null;
    }

    // 1. Stage all changes
    await runGit(["add", "-A"], options.worktreePath);

    // 2. Format commit message
    const commitType =
      options.type ?? this.inferCommitType(options.description);
    const scopePart = options.scope ? `(${options.scope})` : "";
    const header = `${commitType}${scopePart}: ${options.description.trim()}`;
    const footer = `\n\nTask-ID: ${options.taskId}\nStep-Index: ${options.stepIndex}`;
    const fullMessage = (header + (options.body ? `\n\n${options.body.trim()}` : "") + footer).trim();

    // Get parent commit hash
    let parentHash: string | undefined;
    try {
      const parentRes = await runGit(["rev-parse", "HEAD"], options.worktreePath);
      parentHash = parentRes.stdout;
    } catch {
      // First commit in repo may have no parent
    }

    // 3. Commit
    await runGit(["commit", "-m", fullMessage], options.worktreePath);

    // 4. Extract verified commit hash
    const headRes = await runGit(["rev-parse", "HEAD"], options.worktreePath);
    const commitHash = headRes.stdout;

    const commitMeta: SemanticCommitMeta = SemanticCommitMetaSchema.parse({
      type: commitType,
      scope: options.scope,
      description: options.description.trim(),
      body: options.body,
      taskId: options.taskId,
      stepIndex: options.stepIndex,
      commitHash,
      parentHash,
      timestamp: Date.now(),
    });

    return commitMeta;
  }
}
