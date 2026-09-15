import { z } from "zod";
import { DiffSummarySchema } from "./vcs.js";

/**
 * Discrete system event types emitted to the append-only event store.
 */
export const KryptonSystemEventTypeSchema = z.enum([
  "AgentSpawned",
  "PlanUpdated",
  "ToolExecuting",
  "ToolFinished",
  "StateCheckpointed",
  "CrashResumed",
  "AgentStateChanged",
  "ClarificationDispatched",
  "SteeringInterrupted",
]);
export type KryptonSystemEventType = z.infer<
  typeof KryptonSystemEventTypeSchema
>;

/**
 * Base record schema for all append-only event store entries (`events.jsonl`).
 */
export const KryptonSystemEventSchema = z.object({
  sequenceNumber: z.number().int().nonnegative(),
  eventId: z.string().uuid().default(() => crypto.randomUUID()),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
  eventType: KryptonSystemEventTypeSchema,
  agentId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});
export type KryptonSystemEvent = z.infer<typeof KryptonSystemEventSchema>;

/**
 * Prime-Agent Trajectory Step contract capturing verifiable action-observation loops.
 */
export const TrajectoryActionSchema = z.object({
  name: z.string(),
  parameters: z.record(z.string(), z.unknown()).default({}),
  toolCallId: z.string().optional(),
});
export type TrajectoryAction = z.infer<typeof TrajectoryActionSchema>;

export const TrajectoryObservationSchema = z.object({
  output: z.string(),
  isError: z.boolean().default(false),
  truncated: z.boolean().default(false),
  offloadDiskPath: z.string().optional(),
});
export type TrajectoryObservation = z.infer<typeof TrajectoryObservationSchema>;

export const VerificationStatusSchema = z.enum([
  "passed",
  "failed",
  "skipped",
  "unverified",
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const TrajectoryVerificationDetailsSchema = z.object({
  suiteName: z.string().optional(),
  passedChecks: z.number().int().nonnegative().default(0),
  failedChecks: z.number().int().nonnegative().default(0),
  diagnostics: z.string().optional(),
});
export type TrajectoryVerificationDetails = z.infer<
  typeof TrajectoryVerificationDetailsSchema
>;

export const TrajectoryStepSchema = z.object({
  stepId: z.string().uuid().default(() => crypto.randomUUID()),
  agentId: z.string().uuid(),
  taskId: z.string().uuid(),
  stepIndex: z.number().int().nonnegative(),
  action: TrajectoryActionSchema,
  observation: TrajectoryObservationSchema,
  diffSummary: DiffSummarySchema.optional(),
  verificationStatus: VerificationStatusSchema.default("unverified"),
  verificationDetails: TrajectoryVerificationDetailsSchema.optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type TrajectoryStep = z.infer<typeof TrajectoryStepSchema>;

/**
 * Trajectory session container serializable to disk under `short_term/trajectories/`.
 */
export const TrajectorySessionSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  taskId: z.string().uuid(),
  steps: z.array(TrajectoryStepSchema).default([]),
  startedAt: z.number().int().nonnegative().default(() => Date.now()),
  completedAt: z.number().int().nonnegative().optional(),
  finalStatus: z.enum(["completed", "failed", "aborted"]).optional(),
});
export type TrajectorySession = z.infer<typeof TrajectorySessionSchema>;
