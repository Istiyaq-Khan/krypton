import { z } from "zod";
import {
  DiffSummary,
  DiffSummarySchema,
  FilePatch,
  FilePatchSchema,
  MergeApprovalRequest,
  MergeApprovalRequestSchema,
  RollbackRequest,
  RollbackRequestSchema,
  WorktreeContext,
} from "@krypton/shared-types";
import { runGit } from "./worktree.js";

export type RollbackRequestInput = z.input<typeof RollbackRequestSchema>;

/**
 * VCS Diff, Deterministic Rollback & Merge Approval Engine.
 */
export class VcsDiffAndRollbackEngine {
  /**
   * Computes unified diff summary between the worktree HEAD and base commit hash.
   */
  public async getDiffSummary(
    worktreePath: string,
    baseCommitHash: string
  ): Promise<DiffSummary> {
    const headRes = await runGit(["rev-parse", "HEAD"], worktreePath);
    const targetCommitHash = headRes.stdout;

    // 1. Get raw numstat to parse files, additions, deletions
    let numstatOut = "";
    try {
      const res = await runGit(
        ["diff", "--numstat", `${baseCommitHash}..HEAD`],
        worktreePath
      );
      numstatOut = res.stdout;
    } catch {
      // Fallback if baseCommit is the only commit
    }

    // 2. Get status for file status (A, M, D, R)
    let nameStatusOut = "";
    try {
      const res = await runGit(
        ["diff", "--name-status", `${baseCommitHash}..HEAD`],
        worktreePath
      );
      nameStatusOut = res.stdout;
    } catch {
      // Fallback
    }

    const filesMap = new Map<string, Partial<FilePatch>>();

    if (nameStatusOut) {
      for (const line of nameStatusOut.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const statusChar = parts[0][0];
          const filePath = parts[1];
          let status: FilePatch["status"] = "modified";
          if (statusChar === "A") status = "added";
          else if (statusChar === "D") status = "deleted";
          else if (statusChar === "R") status = "renamed";

          filesMap.set(filePath, {
            filePath,
            status,
            oldPath: parts[2],
            additions: 0,
            deletions: 0,
            diffHunk: "",
            hasConflict: false,
          });
        }
      }
    }

    let totalAdditions = 0;
    let totalDeletions = 0;

    if (numstatOut) {
      for (const line of numstatOut.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const adds = parseInt(parts[0], 10) || 0;
          const dels = parseInt(parts[1], 10) || 0;
          const filePath = parts[2];

          totalAdditions += adds;
          totalDeletions += dels;

          const existing = filesMap.get(filePath) || {
            filePath,
            status: "modified" as const,
            hasConflict: false,
          };
          existing.additions = adds;
          existing.deletions = dels;
          filesMap.set(filePath, existing);
        }
      }
    }

    // 3. Get unified diff patch text
    let diffPatchText = "";
    try {
      const res = await runGit(
        ["diff", "-U3", `${baseCommitHash}..HEAD`],
        worktreePath
      );
      diffPatchText = res.stdout;
    } catch {
      // Fallback
    }

    const files: FilePatch[] = [];
    for (const partial of filesMap.values()) {
      files.push(
        FilePatchSchema.parse({
          filePath: partial.filePath!,
          oldPath: partial.oldPath,
          status: partial.status ?? "modified",
          additions: partial.additions ?? 0,
          deletions: partial.deletions ?? 0,
          diffHunk: diffPatchText.slice(0, 10_000), // Cap hunk preview size
          hasConflict: false,
        })
      );
    }

    return DiffSummarySchema.parse({
      baseCommitHash,
      targetCommitHash,
      files,
      totalAdditions,
      totalDeletions,
      totalModifiedFiles: files.length,
      hasConflicts: false,
      conflictFiles: [],
    });
  }

  /**
   * Deterministic rollback: resets hard to last verified commit hash and cleans untracked files.
   */
  public async rollback(request: RollbackRequestInput): Promise<void> {
    const validated = RollbackRequestSchema.parse(request);

    // Hard reset to target verified commit
    await runGit(["reset", "--hard", validated.targetCommitHash], validated.worktreePath);

    // Clean untracked files and directories
    await runGit(["clean", "-fd"], validated.worktreePath);
  }

  /**
   * Prepares a MergeApprovalRequest for human review before merging into user branches.
   */
  public async prepareMergeApproval(options: {
    taskId: string;
    worktreeContext: WorktreeContext;
    targetBranch?: string;
  }): Promise<MergeApprovalRequest> {
    const targetBranch = options.targetBranch ?? "main";
    const diffSummary = await this.getDiffSummary(
      options.worktreeContext.worktreePath,
      options.worktreeContext.baseCommitHash
    );

    // Fetch commit messages created on this task branch
    let commitMessages: string[] = [];
    try {
      const logRes = await runGit(
        [
          "log",
          `${options.worktreeContext.baseCommitHash}..HEAD`,
          "--pretty=format:%s",
        ],
        options.worktreeContext.worktreePath
      );
      if (logRes.stdout) {
        commitMessages = logRes.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      // Fallback
    }

    return MergeApprovalRequestSchema.parse({
      requestId: crypto.randomUUID(),
      taskId: options.taskId,
      targetBranch,
      featureBranch: options.worktreeContext.branchName,
      worktreePath: options.worktreeContext.worktreePath,
      diffSummary,
      commitMessages,
      status: "pending",
      createdAt: Date.now(),
    });
  }
}
