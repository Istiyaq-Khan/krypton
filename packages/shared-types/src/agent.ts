import { z } from "zod";

/**
 * Universal Agent Roles across LLM interactions.
 */
export const RoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * Universal Tool Call representation matching OpenAI and Anthropic formats.
 */
export const ToolCallSchema = z.object({
  id: z.string().min(1, "Tool call ID must not be empty"),
  name: z.string().min(1, "Tool name must not be empty"),
  arguments: z.record(z.string(), z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Universal Tool Execution Result returned into model context.
 */
export const ToolResultSchema = z.object({
  toolCallId: z.string().min(1, "Tool call ID must not be empty"),
  toolName: z.string().min(1, "Tool name must not be empty"),
  content: z.string(),
  isError: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Universal Message schema exchanged across model gateways.
 */
export const MessageSchema = z.object({
  id: z.string().uuid().optional(),
  role: RoleSchema,
  content: z.string(),
  name: z.string().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolResults: z.array(ToolResultSchema).optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type Message = z.infer<typeof MessageSchema>;

/**
 * Lifecycle states of an Actor agent instance.
 */
export const AgentStateSchema = z.enum([
  "uninitialized",
  "idle",
  "planning",
  "executing",
  "awaiting_input",
  "compacting",
  "verifying",
  "completed",
  "failed",
  "aborted",
]);
export type AgentState = z.infer<typeof AgentStateSchema>;

/**
 * Token budget definitions and delegation thresholds.
 */
export const TokenBudgetSchema = z.object({
  hardLimit: z.number().int().positive("Hard token limit must be positive"),
  usedTokens: z.number().int().nonnegative().default(0),
  warningThreshold: z.number().min(0).max(1).default(0.85),
  childAllocationShare: z.number().min(0).max(1).default(0.5),
});
export type TokenBudget = z.infer<typeof TokenBudgetSchema>;

/**
 * Recursion boundaries preventing runaway sub-agent death spirals.
 */
export const RecursionBoundarySchema = z.object({
  maxDepth: z.number().int().min(0).max(3).default(3),
  maxConcurrentChildren: z.number().int().min(1).max(5).default(5),
  timeoutMs: z.number().int().positive().default(60_000),
});
export type RecursionBoundary = z.infer<typeof RecursionBoundarySchema>;

/**
 * Isolated runtime context bound to an Actor agent instance.
 */
export const AgentContextSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1, "Agent name is required"),
  role: z.string().default("general"),
  personaMetadata: z.record(z.string(), z.unknown()).default({}),
  parentAgentId: z.string().uuid().nullable().default(null),
  recursionDepth: z.number().int().min(0).max(3).default(0),
  tokenBudget: TokenBudgetSchema,
  recursionBoundary: RecursionBoundarySchema.default({}),
  state: AgentStateSchema.default("idle"),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type AgentContext = z.infer<typeof AgentContextSchema>;
