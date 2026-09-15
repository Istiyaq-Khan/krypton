import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TrajectoryRecorder } from "../src/trajectory/recorder.js";
import { PreCompletionVerifier } from "../src/trajectory/verifier.js";
import { TaskTree } from "../src/planner/task-tree.js";
import { DynamicReplanner } from "../src/planner/replanner.js";

describe("Prime-Agent Trajectory Recording & Pre-Completion Verification", () => {
  let tempDir: string;
  const agentId = "55555555-5555-5555-5555-555555555555";
  const taskId = "66666666-6666-6666-6666-666666666666";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-traj-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("records step-by-step frames and serializes session to disk", async () => {
    const recorder = new TrajectoryRecorder("evaluator", tempDir);
    const session = recorder.startSession({ agentId, taskId });

    expect(session.sessionId).toBeDefined();
    expect(recorder.getFilePath()).toContain("evaluator");

    // Record Step 0: Inspect repo
    await recorder.recordStep({
      stepIndex: 0,
      action: { name: "inspect_repo", parameters: { path: "./src" } },
      observation: { output: "Found 12 source files", isError: false, truncated: false },
      verificationStatus: "passed",
    });

    // Record Step 1: Synthesize tool
    await recorder.recordStep({
      stepIndex: 1,
      action: { name: "synthesize_script", parameters: { lang: "typescript" } },
      observation: { output: "Script generated", isError: false, truncated: false },
      verificationStatus: "passed",
    });

    // End session
    const ended = await recorder.endSession("completed");
    expect(ended.finalStatus).toBe("completed");
    expect(ended.steps).toHaveLength(2);

    // Read session file from disk and assert fidelity
    const filePath = recorder.getFilePath()!;
    expect(fs.existsSync(filePath)).toBe(true);

    const reloaded = await TrajectoryRecorder.readSession(filePath);
    expect(reloaded.steps).toHaveLength(2);
    expect(reloaded.steps[0].action.name).toBe("inspect_repo");
    expect(reloaded.steps[1].action.name).toBe("synthesize_script");
  });

  it("executes pre-completion verification and triggers dynamic replanner on failure", async () => {
    const verifier = new PreCompletionVerifier();
    const tree = new TaskTree({ agentId, agentName: "verifier_agent" });
    const replanner = new DynamicReplanner();

    const t1 = tree.addTask({ title: "Write microservice", assignedAgentId: agentId });
    const t2 = tree.addTask({
      title: "Deploy service",
      assignedAgentId: agentId,
      dependsOn: [t1.id],
    });

    // Register 2 checks: 1 passing, 1 failing
    verifier.registerCheck("linter", async () => ({ passed: true }));
    verifier.registerCheck("typecheck", async () => ({
      passed: false,
      diagnostics: "TS2322: Type 'string' is not assignable to type 'number'.",
    }));

    const outcome = await verifier.verify(
      { taskId: t1.id, agentId },
      { tree, replanner }
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.failedChecks).toBe(1);
    expect(outcome.passedChecks).toBe(1);
    expect(outcome.diagnostics).toContain("TS2322");

    // Assert that dynamic replanner updated the DAG
    const updatedT1 = tree.getTask(t1.id);
    expect(updatedT1?.status).toBe("failed");

    const updatedT2 = tree.getTask(t2.id);
    expect(updatedT2?.status).toBe("blocked");

    // A remediation task must have been inserted
    const remediation = tree
      .getAllTasks()
      .find((t) => t.metadata.custom?.isRemediation === true);
    expect(remediation).toBeDefined();
    expect(remediation?.description).toContain("TS2322");
  });
});
