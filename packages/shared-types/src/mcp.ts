import { z } from "zod";

/**
 * Standard JSON Schema definition for MCP tool input parameters.
 */
export const McpToolInputSchema = z.object({
  type: z.literal("object").default("object"),
  properties: z.record(z.string(), z.record(z.string(), z.unknown())),
  required: z.array(z.string()).default([]),
  description: z.string().optional(),
  additionalProperties: z.boolean().optional(),
});
export type McpToolInputSchema = z.infer<typeof McpToolInputSchema>;

/**
 * Universal MCP Tool definition compatible with Anthropic and OpenAI specifications.
 */
export const McpToolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().default(""),
  inputSchema: McpToolInputSchema,
  serverName: z.string().optional(),
});
export type McpTool = z.infer<typeof McpToolSchema>;

/**
 * OpenAI Function Tool schema definition.
 */
export const OpenAIFunctionToolSchema = z.object({
  type: z.literal("function").default("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()),
  }),
});
export type OpenAIFunctionTool = z.infer<typeof OpenAIFunctionToolSchema>;

/**
 * Anthropic Native Tool schema definition.
 */
export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: z.record(z.string(), z.unknown()),
});
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;

/**
 * MCP Stdio Transport Configuration.
 */
export const StdioTransportConfigSchema = z.object({
  type: z.literal("stdio").default("stdio"),
  command: z.string().min(1, "Command is required for stdio transport"),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  cwd: z.string().optional(),
});
export type StdioTransportConfig = z.infer<typeof StdioTransportConfigSchema>;

/**
 * MCP Server-Sent Events (SSE) Transport Configuration.
 */
export const SseTransportConfigSchema = z.object({
  type: z.literal("sse").default("sse"),
  url: z.string().url("Valid SSE endpoint URL is required"),
  headers: z.record(z.string(), z.string()).default({}),
  reconnectionOptions: z
    .object({
      maxRetries: z.number().int().nonnegative().default(5),
      retryDelayMs: z.number().int().positive().default(1000),
      timeoutMs: z.number().int().positive().default(30_000),
    })
    .default({}),
});
export type SseTransportConfig = z.infer<typeof SseTransportConfigSchema>;

/**
 * Discriminator schema for MCP Server configuration entries.
 */
export const McpServerConfigSchema = z.object({
  name: z.string().min(1, "MCP server identifier name is required"),
  enabled: z.boolean().default(true),
  transport: z.discriminatedUnion("type", [
    StdioTransportConfigSchema,
    SseTransportConfigSchema,
  ]),
});
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * Tool execution request dispatched to MCP clients or dynamic runner.
 */
export const ToolExecutionRequestSchema = z.object({
  requestId: z.string().uuid().default(() => crypto.randomUUID()),
  agentId: z.string().uuid(),
  toolName: z.string().min(1, "Tool name must not be empty"),
  parameters: z.record(z.string(), z.unknown()).default({}),
  timeoutMs: z.number().int().positive().default(30_000),
  sandbox: z.boolean().default(true),
});
export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;

/**
 * Tool execution result returned from MCP server or sandbox process.
 */
export const ToolExecutionResultSchema = z.object({
  requestId: z.string().uuid(),
  toolName: z.string(),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  exitCode: z.number().int().default(0),
  durationMs: z.number().int().nonnegative(),
  isError: z.boolean().default(false),
  outputOffloaded: z.boolean().default(false),
  offloadDiskPath: z.string().optional(),
  truncatedPreview: z.string().optional(),
});
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;

/**
 * Metadata for ad-hoc runtime synthesized Python or TypeScript tools.
 */
export const SynthesizedToolMetadataSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  name: z.string().min(1, "Synthesized tool name is required"),
  language: z.enum(["python", "typescript"]),
  sourceCode: z.string().min(1, "Source code is required"),
  filePath: z.string().optional(),
  safetyLinterStatus: z
    .enum(["pending", "passed", "flagged", "rejected"])
    .default("pending"),
  flaggedReasons: z.array(z.string()).default([]),
  verificationState: z
    .enum(["unverified", "verified", "failed"])
    .default("unverified"),
  isReusable: z.boolean().default(false),
  promotedToGlobalSkill: z.boolean().default(false),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type SynthesizedToolMetadata = z.infer<
  typeof SynthesizedToolMetadataSchema
>;
