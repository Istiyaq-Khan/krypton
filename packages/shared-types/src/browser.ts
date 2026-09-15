import { z } from "zod";

/**
 * Bounding rectangle for visual and interactive DOM / AXTree elements.
 */
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

/**
 * Pruned semantic accessibility tree node with transient sequential numeric ID.
 */
export const AXNodeSchema = z.object({
  id: z.number().int().positive(),
  backendDOMNodeId: z.number().int().optional(),
  role: z.string(),
  name: z.string().default(""),
  value: z.string().optional(),
  description: z.string().optional(),
  bounds: BoundingBoxSchema,
  isActionable: z.boolean().default(false),
  disabled: z.boolean().default(false),
  focused: z.boolean().default(false),
  children: z.array(z.number().int().positive()).default([]),
});
export type AXNode = z.infer<typeof AXNodeSchema>;

/**
 * Lightweight, semantic snapshot of the page accessibility tree for blind navigation.
 */
export const AXTreeSnapshotSchema = z.object({
  url: z.string(),
  title: z.string().default(""),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
  totalRawNodes: z.number().int().nonnegative(),
  interactiveNodes: z.array(AXNodeSchema),
  prunedNodeCount: z.number().int().nonnegative(),
  reductionPercentage: z.number().min(0).max(100),
  formattedSnapshot: z.string().optional(),
});
export type AXTreeSnapshot = z.infer<typeof AXTreeSnapshotSchema>;

/**
 * Browser action types for blind navigation.
 */
export const BrowserActionTypeSchema = z.enum([
  "click",
  "type",
  "select",
  "scroll",
  "hover",
]);
export type BrowserActionType = z.infer<typeof BrowserActionTypeSchema>;

/**
 * Blind navigation action request dispatched by an agent.
 */
export const BrowserActionRequestSchema = z.object({
  action: BrowserActionTypeSchema,
  targetId: z.number().int().positive().optional(),
  selector: z.string().optional(),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  text: z.string().optional(),
  value: z.string().optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
  amount: z.number().positive().optional(),
  agentName: z.string().optional(),
});
export type BrowserActionRequest = z.infer<typeof BrowserActionRequestSchema>;

/**
 * Result of executing a browser action.
 */
export const BrowserActionResultSchema = z.object({
  success: z.boolean(),
  action: BrowserActionTypeSchema,
  targetId: z.number().int().positive().optional(),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative(),
});
export type BrowserActionResult = z.infer<typeof BrowserActionResultSchema>;

/**
 * Metadata for active browser contexts tracked in BrowserContextPool.
 */
export const BrowserContextInfoSchema = z.object({
  contextId: z.string(),
  createdAt: z.number().int().nonnegative(),
  lastAccessedAt: z.number().int().nonnegative(),
  isIdle: z.boolean().default(false),
  pageCount: z.number().int().nonnegative().default(0),
  userAgent: z.string(),
});
export type BrowserContextInfo = z.infer<typeof BrowserContextInfoSchema>;

/**
 * Statistics and health metrics for the browser context pool.
 */
export const BrowserPoolStatsSchema = z.object({
  activeContextCount: z.number().int().nonnegative(),
  maxContexts: z.number().int().positive().default(2),
  idleContextCount: z.number().int().nonnegative(),
  recycledCount: z.number().int().nonnegative(),
});
export type BrowserPoolStats = z.infer<typeof BrowserPoolStatsSchema>;
