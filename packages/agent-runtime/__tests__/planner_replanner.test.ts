import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TaskTree, TaskCycleError, TaskNotFoundError } from "../src/planner/task-tree.js";
import { DynamicReplanner } from "../src/planner/replanner.js";

describe("Planner Task Tree & Dynamic Error Replanner", () => {
  let tempDir: string;
  const agentId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-planner-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("builds a multi-stage DAG and computes next executable tasks", () => {
    const tree = new TaskTree({ agentId, agentName: "coder" });

    // Task 1: Scan repository
    const task1 = tree.addTask({
      title: "Scan repository",
      assignedAgentId: agentId,
    });

    // Task 2: Refactor auth module (depends on task 1)
    const task2 = tree.addTask({
      title: "Refactor auth module",
      assignedAgentId: agentId,
      dependsOn: [task1.id],
    });

    // Task 3: Run unit tests (depends on task 2)
    const task3 = tree.addTask({
      title: "Run unit tests",
      assignedAgentId: agentId,
      dependsOn: [task2.id],
    });

    // Initially, only Task 1 is executable
    let executables = tree.getNextExecutableTasks();
    expect(executables).toHaveLength(1);
    expect(executables[0].id).toBe(task1.id);

    // Complete Task 1
    tree.completeTask(task1.id);

    // Now Task 2 becomes executable
    executables = tree.getNextExecutableTasks();
    expect(executables).toHaveLength(1);
    expect(executables[0].id).toBe(task2.id);

    // Complete Task 2
    tree.completeTask(task2.id);

    // Now Task 3 becomes executable
    executables = tree.getNextExecutableTasks();
    expect(executables).toHaveLength(1);
    expect(executables[0].id).toBe(task3.id);
  });

  it("detects and rejects cyclic dependencies in task DAG", () => {
    const tree = new TaskTree({ agentId });

    const taskA = tree.addTask({
      title: "Task A",
      assignedAgentId: agentId,
    });

    const taskB = tree.addTask({
      title: "Task B",
      assignedAgentId: agentId,
      dependsOn: [taskA.id],
    });

    // Attempting to update Task A's dependencies to depend on Task B must fail with TaskCycleError
    expect(() => {
      tree.applyPatch({
        op: "updateDependencies",
        taskId: taskA.id,
        dependsOn: [taskB.id],
      });
    }).toThrow(TaskCycleError);
  });

  it("dynamically replans on failure: blocks downstream tasks and inserts remediation sub-task", () => {
    const tree = new TaskTree({ agentId, agentName: "architect" });
    const replanner = new DynamicReplanner();

    const t1 = tree.addTask({ title: "Setup database", assignedAgentId: agentId });
    const t2 = tree.addTask({
      title: "Run migrations",
      assignedAgentId: agentId,
      dependsOn: [t1.id],
    });
    const t3 = tree.addTask({
      title: "Deploy API",
      assignedAgentId: agentId,
      dependsOn: [t2.id],
    });

    // Complete t1
    tree.completeTask(t1.id);

    // t2 starts and fails
    tree.updateTaskStatus(t2.id, "in_progress");

    // DynamicReplanner handles failure
    const batch = replanner.handleFailure({
      tree,
      failedTaskId: t2.id,
      errorDiagnostics: "SyntaxError: relation 'users' already exists in schema",
      suggestedRemediationTitle: "Fix duplicate migration file",
    });

    expect(batch.patches.length).toBeGreaterThanOrEqual(3);

    // Verify t2 is marked failed
    const updatedT2 = tree.getTask(t2.id);
    expect(updatedT2?.status).toBe("failed");
    expect(updatedT2?.metadata.error).toContain("SyntaxError");

    // Verify downstream t3 is blocked
    const updatedT3 = tree.getTask(t3.id);
    expect(updatedT3?.status).toBe("blocked");

    // Verify remediation task was inserted
    const allTasks = tree.getAllTasks();
    const remediationTask = allTasks.find(
      (t) => t.metadata.custom?.isRemediation === true
    );
    expect(remediationTask).toBeDefined();
    expect(remediationTask?.title).toBe("Fix duplicate migration file");
    expect(remediationTask?.status).toBe("pending");

    // Verify t3 was rewired to depend on the remediation task
    expect(updatedT3?.dependsOn).toContain(remediationTask!.id);
  });

  it("serializes task DAG state to and from human-readable TODO.md format", async () => {
    const tree = new TaskTree({ agentId, agentName: "doc_agent" });

    const t1 = tree.addTask({ title: "Step 1: Init", assignedAgentId: agentId });
    const t2 = tree.addTask({
      title: "Step 2: Build",
      assignedAgentId: agentId,
      dependsOn: [t1.id],
    });

    tree.completeTask(t1.id);
    tree.updateTaskStatus(t2.id, "in_progress");

    const todoPath = path.join(tempDir, "TODO.md");
    await tree.syncToMarkdownFile(todoPath);

    expect(fs.existsSync(todoPath)).toBe(true);
    const content = fs.readFileSync(todoPath, "utf-8");
    expect(content).toContain("# Task DAG: doc_agent");
    expect(content).toContain("- [x] **Step 1: Init**");
    expect(content).toContain("- [/] **Step 2: Build**");
  });
});
