import { z } from "zod";

/**
 * Valid execution states for a task node in the planner DAG.
 */
export const TaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "blocked",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Execution metadata tracking timing, retries, and artifacts.
 */
export const TaskExecutionMetadataSchema = z.object({
  startedAt: z.number().int().nonnegative().optional(),
  completedAt: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
  stepIndex: z.number().int().nonnegative().optional(),
  verifiedCommitHash: z.string().optional(),
  outputOffloadPath: z.string().optional(),
  custom: z.record(z.string(), z.unknown()).default({}),
});
export type TaskExecutionMetadata = z.infer<typeof TaskExecutionMetadataSchema>;

/**
 * A single node within the hierarchical Directed Acyclic Graph (DAG).
 */
export const TaskNodeSchema = z.object({
  id: z.string().uuid("Task ID must be a valid UUID"),
  title: z.string().min(1, "Task title is required"),
  description: z.string().default(""),
  assignedAgentId: z.string().uuid("Assigned agent ID must be a valid UUID"),
  dependsOn: z.array(z.string().uuid()).default([]),
  status: TaskStatusSchema.default("pending"),
  subTaskIds: z.array(z.string().uuid()).default([]),
  metadata: TaskExecutionMetadataSchema.default({}),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type TaskNode = z.infer<typeof TaskNodeSchema>;

/**
 * In-memory container structure representing an entire Task DAG.
 */
export const TaskTreeSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  agentId: z.string().uuid(),
  rootTaskIds: z.array(z.string().uuid()).default([]),
  tasks: z.record(z.string().uuid(), TaskNodeSchema).default({}),
  version: z.number().int().nonnegative().default(1),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type TaskTree = z.infer<typeof TaskTreeSchema>;

/**
 * Dynamic DAG modification operations emitted during execution and replanning.
 */
export const InsertTaskPatchSchema = z.object({
  op: z.literal("insertTask"),
  task: TaskNodeSchema,
  parentTaskId: z.string().uuid().optional(),
});

export const RemoveTaskPatchSchema = z.object({
  op: z.literal("removeTask"),
  taskId: z.string().uuid(),
});

export const UpdateDependenciesPatchSchema = z.object({
  op: z.literal("updateDependencies"),
  taskId: z.string().uuid(),
  dependsOn: z.array(z.string().uuid()),
});

export const RetryTaskPatchSchema = z.object({
  op: z.literal("retryTask"),
  taskId: z.string().uuid(),
  resetSubtasks: z.boolean().default(false),
});

export const MarkFailedPatchSchema = z.object({
  op: z.literal("markFailed"),
  taskId: z.string().uuid(),
  reason: z.string().min(1, "Failure reason is required"),
  suggestedRemediation: z.string().optional(),
});

export const UpdateTaskStatusPatchSchema = z.object({
  op: z.literal("updateStatus"),
  taskId: z.string().uuid(),
  status: TaskStatusSchema,
  metadataUpdates: TaskExecutionMetadataSchema.partial().optional(),
});

export const PlanPatchSchema = z.discriminatedUnion("op", [
  InsertTaskPatchSchema,
  RemoveTaskPatchSchema,
  UpdateDependenciesPatchSchema,
  RetryTaskPatchSchema,
  MarkFailedPatchSchema,
  UpdateTaskStatusPatchSchema,
]);
export type PlanPatch = z.infer<typeof PlanPatchSchema>;

export const PlanPatchBatchSchema = z.object({
  batchId: z.string().uuid().default(() => crypto.randomUUID()),
  agentId: z.string().uuid(),
  treeId: z.string().uuid(),
  patches: z.array(PlanPatchSchema).min(1),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type PlanPatchBatch = z.infer<typeof PlanPatchBatchSchema>;

/**
 * Markdown item entry for TODO.md bidirectional serialization.
 */
export const TaskMarkdownEntrySchema = z.object({
  taskId: z.string().uuid().optional(),
  title: z.string(),
  completed: z.boolean(),
  depth: z.number().int().min(0).default(0),
  status: TaskStatusSchema.default("pending"),
  rawLine: z.string().optional(),
});
export type TaskMarkdownEntry = z.infer<typeof TaskMarkdownEntrySchema>;

/**
 * Container contract for synchronizing in-memory DAGs to human-readable Markdown format (TODO.md).
 */
export const TaskMarkdownSyncSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  markdownContent: z.string(),
  entries: z.array(TaskMarkdownEntrySchema),
  syncedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type TaskMarkdownSync = z.infer<typeof TaskMarkdownSyncSchema>;
