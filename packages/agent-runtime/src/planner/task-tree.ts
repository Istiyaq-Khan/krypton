import * as fs from "node:fs";
import * as path from "node:path";
import {
  TaskNode,
  TaskNodeSchema,
  TaskStatus,
  TaskStatusSchema,
  TaskTree as ITaskTree,
  TaskTreeSchema,
  PlanPatch,
  PlanPatchBatch,
  TaskExecutionMetadata,
} from "@krypton/shared-types";

export class TaskCycleError extends Error {
  constructor(taskId: string, cyclePath: string[]) {
    super(
      `Cyclic dependency detected in task tree for task ${taskId}: path [${cyclePath.join(
        " -> "
      )}]`
    );
    this.name = "TaskCycleError";
  }
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task with id '${taskId}' not found in task tree`);
    this.name = "TaskNotFoundError";
  }
}

export interface AddTaskOptions {
  id?: string;
  title: string;
  description?: string;
  assignedAgentId: string;
  dependsOn?: string[];
  parentTaskId?: string;
  status?: TaskStatus;
  metadata?: Partial<TaskExecutionMetadata>;
}

/**
 * In-memory Hierarchical Directed Acyclic Graph (DAG) Task Tree.
 * Supports cycle detection, topological readiness checks, dynamic patching,
 * and synchronization to human-readable Markdown format (TODO.md).
 */
export class TaskTree {
  public readonly id: string;
  public readonly agentId: string;
  public readonly agentName: string;
  private tasks = new Map<string, TaskNode>();
  private rootTaskIds: string[] = [];
  private version = 1;
  private createdAt: number;
  private updatedAt: number;

  constructor(options: {
    id?: string;
    agentId: string;
    agentName?: string;
    rootTaskIds?: string[];
    tasks?: Record<string, TaskNode>;
    version?: number;
    createdAt?: number;
    updatedAt?: number;
  }) {
    this.id = options.id ?? crypto.randomUUID();
    this.agentId = options.agentId;
    this.agentName = options.agentName ?? "agent";
    this.version = options.version ?? 1;
    this.createdAt = options.createdAt ?? Date.now();
    this.updatedAt = options.updatedAt ?? Date.now();
    this.rootTaskIds = options.rootTaskIds ? [...options.rootTaskIds] : [];

    if (options.tasks) {
      for (const [taskId, node] of Object.entries(options.tasks)) {
        this.tasks.set(taskId, TaskNodeSchema.parse(node));
      }
    }
  }

  public getVersion(): number {
    return this.version;
  }

  public getTask(taskId: string): TaskNode | undefined {
    return this.tasks.get(taskId);
  }

  public getAllTasks(): TaskNode[] {
    return Array.from(this.tasks.values());
  }

  public getRootTasks(): TaskNode[] {
    return this.rootTaskIds
      .map((id) => this.tasks.get(id))
      .filter((t): t is TaskNode => t !== undefined);
  }

  /**
   * Validates if adding an edge from fromId -> toId would introduce a cycle.
   */
  private detectCycle(targetTaskId: string, proposedDependencies: string[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const checkCycle = (currentId: string, path: string[]): boolean => {
      visited.add(currentId);
      recursionStack.add(currentId);

      const deps =
        currentId === targetTaskId
          ? proposedDependencies
          : this.tasks.get(currentId)?.dependsOn ?? [];

      for (const depId of deps) {
        if (!visited.has(depId)) {
          if (checkCycle(depId, [...path, depId])) return true;
        } else if (recursionStack.has(depId)) {
          throw new TaskCycleError(targetTaskId, [...path, depId]);
        }
      }

      recursionStack.delete(currentId);
      return false;
    };

    checkCycle(targetTaskId, [targetTaskId]);
  }

  /**
   * Adds a task node to the DAG with dependency and cycle validation.
   */
  public addTask(options: AddTaskOptions): TaskNode {
    const taskId = options.id ?? crypto.randomUUID();
    const dependsOn = options.dependsOn ?? [];

    // Verify dependencies exist
    for (const depId of dependsOn) {
      if (!this.tasks.has(depId)) {
        throw new TaskNotFoundError(depId);
      }
    }

    // Verify cycle freedom
    this.detectCycle(taskId, dependsOn);

    const taskNode: TaskNode = TaskNodeSchema.parse({
      id: taskId,
      title: options.title,
      description: options.description ?? "",
      assignedAgentId: options.assignedAgentId,
      dependsOn,
      status: options.status ?? "pending",
      subTaskIds: [],
      metadata: {
        retryCount: 0,
        ...options.metadata,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.tasks.set(taskId, taskNode);

    if (options.parentTaskId) {
      const parent = this.tasks.get(options.parentTaskId);
      if (!parent) {
        throw new TaskNotFoundError(options.parentTaskId);
      }
      if (!parent.subTaskIds.includes(taskId)) {
        parent.subTaskIds.push(taskId);
        parent.updatedAt = Date.now();
      }
    } else {
      if (!this.rootTaskIds.includes(taskId)) {
        this.rootTaskIds.push(taskId);
      }
    }

    this.version++;
    this.updatedAt = Date.now();
    return taskNode;
  }

  /**
   * Returns tasks ready to be executed:
   * Status is 'pending', and all upstream dependencies are 'completed'.
   */
  public getNextExecutableTasks(): TaskNode[] {
    const executables: TaskNode[] = [];

    for (const task of this.tasks.values()) {
      if (task.status !== "pending") {
        continue;
      }

      // Check if all dependencies are completed
      const allDepsCompleted = task.dependsOn.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep?.status === "completed";
      });

      if (allDepsCompleted) {
        executables.push(task);
      }
    }

    return executables;
  }

  /**
   * Updates task status and associated execution timing.
   */
  public updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    metadataUpdates?: Partial<TaskExecutionMetadata>
  ): TaskNode {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    task.status = TaskStatusSchema.parse(status);
    task.updatedAt = Date.now();

    if (status === "in_progress" && !task.metadata.startedAt) {
      task.metadata.startedAt = Date.now();
    } else if (status === "completed" || status === "failed") {
      task.metadata.completedAt = Date.now();
      if (task.metadata.startedAt) {
        task.metadata.durationMs =
          task.metadata.completedAt - task.metadata.startedAt;
      }
    }

    if (metadataUpdates) {
      task.metadata = {
        ...task.metadata,
        ...metadataUpdates,
      };
    }

    this.version++;
    this.updatedAt = Date.now();
    return task;
  }

  public completeTask(
    taskId: string,
    metadataUpdates?: Partial<TaskExecutionMetadata>
  ): TaskNode {
    return this.updateTaskStatus(taskId, "completed", metadataUpdates);
  }

  public failTask(
    taskId: string,
    reason: string,
    suggestedRemediation?: string
  ): TaskNode {
    return this.updateTaskStatus(taskId, "failed", {
      error: reason,
      custom: suggestedRemediation
        ? { suggestedRemediation }
        : undefined,
    });
  }

  /**
   * Returns all downstream tasks that depend directly or indirectly on `taskId`.
   */
  public getDownstreamDependents(taskId: string): TaskNode[] {
    const dependents: TaskNode[] = [];
    const queue = [taskId];
    const seen = new Set<string>([taskId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const node of this.tasks.values()) {
        if (node.dependsOn.includes(currentId) && !seen.has(node.id)) {
          seen.add(node.id);
          dependents.push(node);
          queue.push(node.id);
        }
      }
    }

    return dependents;
  }

  /**
   * Applies an atomic PlanPatch operation.
   */
  public applyPatch(patch: PlanPatch): void {
    switch (patch.op) {
      case "insertTask": {
        this.addTask({
          id: patch.task.id,
          title: patch.task.title,
          description: patch.task.description,
          assignedAgentId: patch.task.assignedAgentId,
          dependsOn: patch.task.dependsOn,
          parentTaskId: patch.parentTaskId,
          status: patch.task.status,
          metadata: patch.task.metadata,
        });
        break;
      }
      case "removeTask": {
        const task = this.tasks.get(patch.taskId);
        if (task) {
          this.tasks.delete(patch.taskId);
          this.rootTaskIds = this.rootTaskIds.filter((id) => id !== patch.taskId);
          // Remove from other tasks' dependsOn
          for (const other of this.tasks.values()) {
            other.dependsOn = other.dependsOn.filter((id) => id !== patch.taskId);
            other.subTaskIds = other.subTaskIds.filter((id) => id !== patch.taskId);
          }
          this.version++;
          this.updatedAt = Date.now();
        }
        break;
      }
      case "updateDependencies": {
        const task = this.tasks.get(patch.taskId);
        if (!task) throw new TaskNotFoundError(patch.taskId);
        this.detectCycle(patch.taskId, patch.dependsOn);
        task.dependsOn = [...patch.dependsOn];
        task.updatedAt = Date.now();
        this.version++;
        this.updatedAt = Date.now();
        break;
      }
      case "retryTask": {
        const task = this.tasks.get(patch.taskId);
        if (!task) throw new TaskNotFoundError(patch.taskId);
        task.status = "pending";
        task.metadata.retryCount = (task.metadata.retryCount ?? 0) + 1;
        task.metadata.error = undefined;
        task.updatedAt = Date.now();
        if (patch.resetSubtasks) {
          for (const subId of task.subTaskIds) {
            const sub = this.tasks.get(subId);
            if (sub) {
              sub.status = "pending";
              sub.updatedAt = Date.now();
            }
          }
        }
        this.version++;
        this.updatedAt = Date.now();
        break;
      }
      case "markFailed": {
        this.failTask(patch.taskId, patch.reason, patch.suggestedRemediation);
        break;
      }
      case "updateStatus": {
        this.updateTaskStatus(patch.taskId, patch.status, patch.metadataUpdates);
        break;
      }
    }
  }

  public applyBatch(batch: PlanPatchBatch): void {
    for (const patch of batch.patches) {
      this.applyPatch(patch);
    }
  }

  /**
   * Serializes the DAG into a clean, human-readable Markdown format for TODO.md.
   */
  public toMarkdown(): string {
    const lines: string[] = [
      `# Task DAG: ${this.agentName}`,
      `> Tree ID: \`${this.id}\` | Version: ${this.version} | Total Tasks: ${this.tasks.size}`,
      "",
      "## Execution Progress",
      "",
    ];

    const formatStatusBadge = (status: TaskStatus): string => {
      switch (status) {
        case "completed":
          return "[x]";
        case "in_progress":
          return "[/]";
        case "failed":
          return "[!]";
        case "blocked":
          return "[-]";
        case "pending":
        default:
          return "[ ]";
      }
    };

    const visited = new Set<string>();

    const printTaskAndSubtasks = (taskId: string, indent: number) => {
      const task = this.tasks.get(taskId);
      if (!task || visited.has(taskId)) return;
      visited.add(taskId);

      const badge = formatStatusBadge(task.status);
      const prefix = "  ".repeat(indent) + `- ${badge} **${task.title}**`;
      const depsInfo =
        task.dependsOn.length > 0
          ? ` *(depends on: ${task.dependsOn.map((id) => this.tasks.get(id)?.title ?? id).join(", ")})*`
          : "";
      const statusNote =
        task.status === "failed" && task.metadata.error
          ? ` *(FAILED: ${task.metadata.error})*`
          : "";

      lines.push(`${prefix}${depsInfo}${statusNote} \`[${task.id}]\``);

      if (task.description) {
        lines.push(`${"  ".repeat(indent + 1)}> ${task.description}`);
      }

      for (const subId of task.subTaskIds) {
        printTaskAndSubtasks(subId, indent + 1);
      }
    };

    // Print roots first
    for (const rootId of this.rootTaskIds) {
      printTaskAndSubtasks(rootId, 0);
    }

    // Print any orphans
    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        printTaskAndSubtasks(taskId, 0);
      }
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Synchronizes the in-memory task tree directly to ~/.krypton/agents/<agentName>/TODO.md.
   */
  public async syncToMarkdownFile(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const markdown = this.toMarkdown();
    await fs.promises.writeFile(filePath, markdown, "utf-8");
  }

  public toJSON(): ITaskTree {
    const tasksObj: Record<string, TaskNode> = {};
    for (const [id, task] of this.tasks.entries()) {
      tasksObj[id] = task;
    }

    return TaskTreeSchema.parse({
      id: this.id,
      agentId: this.agentId,
      rootTaskIds: this.rootTaskIds,
      tasks: tasksObj,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }

  public static fromJSON(data: ITaskTree, agentName?: string): TaskTree {
    return new TaskTree({
      id: data.id,
      agentId: data.agentId,
      agentName,
      rootTaskIds: data.rootTaskIds,
      tasks: data.tasks,
      version: data.version,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
