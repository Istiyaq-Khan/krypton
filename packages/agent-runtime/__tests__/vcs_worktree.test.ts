import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { WorktreeManager, runGit } from "../src/vcs/worktree.js";
import { AutonomousCommitGenerator } from "../src/vcs/commit.js";
import { VcsDiffAndRollbackEngine } from "../src/vcs/diff.js";

describe("Krypton-VCS: Worktree Isolation, Semantic Commits & Rollback Engine", () => {
  let tempRoot: string;
  let repoDir: string;
  let kryptonHome: string;
  let worktreeManager: WorktreeManager;
  let commitGen: AutonomousCommitGenerator;
  let vcsEngine: VcsDiffAndRollbackEngine;

  beforeEach(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-vcs-test-"));
    repoDir = path.join(tempRoot, "mock-repo");
    kryptonHome = path.join(tempRoot, ".krypton");

    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(kryptonHome, { recursive: true });

    // Initialize mock git repository
    await runGit(["init"], repoDir);
    await runGit(["config", "user.name", "Krypton Test"], repoDir);
    await runGit(["config", "user.email", "test@krypton.local"], repoDir);

    // Initial commit
    const initialFile = path.join(repoDir, "README.md");
    fs.writeFileSync(initialFile, "# Mock Project\nInitial baseline\n", "utf-8");
    await runGit(["add", "README.md"], repoDir);
    await runGit(["commit", "-m", "chore: initial commit"], repoDir);

    worktreeManager = new WorktreeManager({ customRoot: kryptonHome });
    commitGen = new AutonomousCommitGenerator();
    vcsEngine = new VcsDiffAndRollbackEngine();
  });

  afterEach(async () => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates isolated worktree on dedicated branch without dirtying user workspace", async () => {
    const taskId = "22222222-2222-2222-2222-222222222222";
    const context = await worktreeManager.createWorktree({
      taskId,
      targetRepoPath: repoDir,
      customRoot: kryptonHome,
    });

    expect(context.taskId).toBe(taskId);
    expect(context.branchName).toBe(`krypton/${taskId}`);
    expect(fs.existsSync(context.worktreePath)).toBe(true);

    // Verify main repo HEAD is unchanged and clean
    const statusInMain = await runGit(["status", "--porcelain"], repoDir);
    expect(statusInMain.stdout).toBe("");

    // Make an edit strictly in the isolated worktree
    const worktreeFile = path.join(context.worktreePath, "feature.ts");
    fs.writeFileSync(worktreeFile, "export const x = 42;\n", "utf-8");

    // Main repo must NOT have feature.ts
    const mainFeatureFile = path.join(repoDir, "feature.ts");
    expect(fs.existsSync(mainFeatureFile)).toBe(false);

    // Worktree must have feature.ts
    expect(fs.existsSync(worktreeFile)).toBe(true);

    // Cleanup worktree
    await worktreeManager.removeWorktree(context, { deleteBranch: true });
    expect(fs.existsSync(context.worktreePath)).toBe(false);
  });

  it("generates atomic Conventional Commits with task tracking metadata", async () => {
    const taskId = "33333333-3333-3333-3333-333333333333";
    const context = await worktreeManager.createWorktree({
      taskId,
      targetRepoPath: repoDir,
      customRoot: kryptonHome,
    });

    // Create a new source file
    const authFile = path.join(context.worktreePath, "auth.ts");
    fs.writeFileSync(authFile, "export function login() { return true; }\n", "utf-8");

    // Commit step
    const commitMeta = await commitGen.commitStep({
      worktreePath: context.worktreePath,
      taskId,
      stepIndex: 1,
      type: "feat",
      scope: "auth",
      description: "implement login handler",
    });

    expect(commitMeta).not.toBeNull();
    expect(commitMeta?.type).toBe("feat");
    expect(commitMeta?.scope).toBe("auth");
    expect(commitMeta?.commitHash).toBeDefined();

    // Verify commit in worktree log
    const logRes = await runGit(["log", "-n", "1", "--pretty=format:%B"], context.worktreePath);
    expect(logRes.stdout).toContain("feat(auth): implement login handler");
    expect(logRes.stdout).toContain(`Task-ID: ${taskId}`);
    expect(logRes.stdout).toContain("Step-Index: 1");

    await worktreeManager.removeWorktree(context, { deleteBranch: true });
  });

  it("calculates diff summary, performs deterministic rollback on step failure, and prepares merge approval", async () => {
    const taskId = "44444444-4444-4444-4444-444444444444";
    const context = await worktreeManager.createWorktree({
      taskId,
      targetRepoPath: repoDir,
      customRoot: kryptonHome,
    });

    const baselineHash = context.baseCommitHash;

    // Step 1: Good commit
    const goodFile = path.join(context.worktreePath, "math.ts");
    fs.writeFileSync(goodFile, "export const add = (a: number, b: number) => a + b;\n", "utf-8");
    const commit1 = await commitGen.commitStep({
      worktreePath: context.worktreePath,
      taskId,
      stepIndex: 1,
      type: "feat",
      description: "add math helper",
    });
    const verifiedHash = commit1!.commitHash!;

    // Step 2: Broken commit that fails verification
    const brokenFile = path.join(context.worktreePath, "broken.ts");
    fs.writeFileSync(brokenFile, "this is invalid code;\n", "utf-8");
    await commitGen.commitStep({
      worktreePath: context.worktreePath,
      taskId,
      stepIndex: 2,
      type: "fix",
      description: "faulty step that broke builds",
    });

    expect(fs.existsSync(brokenFile)).toBe(true);

    // Execute Deterministic Rollback to last verified commit
    await vcsEngine.rollback({
      requestId: crypto.randomUUID(),
      taskId,
      worktreePath: context.worktreePath,
      targetCommitHash: verifiedHash,
      reason: "Compilation error in broken.ts",
      force: true,
      timestamp: Date.now(),
    });

    // Verify broken.ts is eliminated and HEAD matches verifiedHash
    expect(fs.existsSync(brokenFile)).toBe(false);
    expect(fs.existsSync(goodFile)).toBe(true);

    const headRes = await runGit(["rev-parse", "HEAD"], context.worktreePath);
    expect(headRes.stdout).toBe(verifiedHash);

    // Compute diff summary compared to baseline
    const diff = await vcsEngine.getDiffSummary(context.worktreePath, baselineHash);
    expect(diff.totalModifiedFiles).toBe(1);
    expect(diff.files[0].filePath).toBe("math.ts");
    expect(diff.files[0].status).toBe("added");

    // Prepare merge approval request
    const approvalReq = await vcsEngine.prepareMergeApproval({
      taskId,
      worktreeContext: context,
      targetBranch: "main",
    });
    expect(approvalReq.status).toBe("pending");
    expect(approvalReq.commitMessages).toHaveLength(1);
    expect(approvalReq.commitMessages[0]).toContain("feat: add math helper");

    await worktreeManager.removeWorktree(context, { deleteBranch: true });
  });
});
