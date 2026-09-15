import { z } from "zod";
import { ClarificationRequestSchema, InteractionChannelSchema } from "./interaction.js";

/**
 * Standard IPC endpoints for platform-native communications.
 */
export const WINDOWS_NAMED_PIPE = "\\\\.\\pipe\\krypton-ipc";
export const POSIX_DOMAIN_SOCKET = "/tmp/krypton.sock";
export const DEFAULT_WS_PORT = 19840;
export const DEFAULT_RPC_PORT = 19841;

/**
 * JSON-RPC 2.0 Request Envelope.
 */
export const JsonRpcIdSchema = z.union([z.string(), z.number(), z.null()]);
export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>;

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0").default("2.0"),
  id: JsonRpcIdSchema,
  method: z.string().min(1, "Method is required"),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

/**
 * JSON-RPC 2.0 Error Object.
 */
export const JsonRpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;

/**
 * JSON-RPC 2.0 Response Envelope.
 */
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0").default("2.0"),
  id: JsonRpcIdSchema,
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional(),
});
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

/**
 * JSON-RPC 2.0 Notification Envelope (no ID, unidirectional).
 */
export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0").default("2.0"),
  method: z.string().min(1, "Method is required"),
  params: z.unknown().optional(),
});
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;

/**
 * Streaming Token Chunk sent to clients over WebSocket.
 */
export const TokenStreamChunkSchema = z.object({
  type: z.literal("token_stream"),
  agentId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  delta: z.string(),
  isComplete: z.boolean().default(false),
  index: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type TokenStreamChunk = z.infer<typeof TokenStreamChunkSchema>;

/**
 * Structured Agent Log Event emitted to consoles and dashboards.
 */
export const AgentLogEventSchema = z.object({
  type: z.literal("agent_log"),
  agentId: z.string().uuid(),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type AgentLogEvent = z.infer<typeof AgentLogEventSchema>;

/**
 * Real-time Task Tree synchronization event.
 */
export const TaskTreeUpdatedEventSchema = z.object({
  type: z.literal("task_tree_updated"),
  treeId: z.string().uuid(),
  agentId: z.string().uuid(),
  serializedTasks: z.record(z.string(), z.unknown()),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type TaskTreeUpdatedEvent = z.infer<typeof TaskTreeUpdatedEventSchema>;

/**
 * High-priority HITL clarification prompt event.
 */
export const ClarificationRequestedEventSchema = z.object({
  type: z.literal("clarification_requested"),
  request: ClarificationRequestSchema,
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type ClarificationRequestedEvent = z.infer<
  typeof ClarificationRequestedEventSchema
>;

/**
 * Mid-flight asynchronous user steering input event.
 */
export const SteeringInputEventSchema = z.object({
  type: z.literal("steering_input"),
  agentId: z.string().uuid().optional(),
  instruction: z.string().min(1, "Instruction is required"),
  source: InteractionChannelSchema,
  priority: z.enum(["immediate", "queued"]).default("immediate"),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type SteeringInputEvent = z.infer<typeof SteeringInputEventSchema>;

/**
 * Streaming speech-to-text transcription event from Parakeet v3 or Whisper.
 */
export const VoiceTranscribedEventSchema = z.object({
  type: z.literal("voice_transcribed"),
  transcript: z.string(),
  isFinal: z.boolean().default(false),
  targetAgent: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type VoiceTranscribedEvent = z.infer<typeof VoiceTranscribedEventSchema>;

/**
 * Discriminated union of all WebSocket stream packets.
 */
export const WebSocketPacketSchema = z.discriminatedUnion("type", [
  TokenStreamChunkSchema,
  AgentLogEventSchema,
  TaskTreeUpdatedEventSchema,
  ClarificationRequestedEventSchema,
  SteeringInputEventSchema,
  VoiceTranscribedEventSchema,
]);
export type WebSocketPacket = z.infer<typeof WebSocketPacketSchema>;

/**
 * Platform IPC Transport definition and connection config.
 */
export const IpcTransportTypeSchema = z.enum([
  "named_pipe",
  "domain_socket",
  "websocket",
  "stdio",
]);
export type IpcTransportType = z.infer<typeof IpcTransportTypeSchema>;

export const IpcConnectionConfigSchema = z.object({
  transport: IpcTransportTypeSchema,
  endpoint: z.string(),
  authSecret: z.string().optional(),
  timeoutMs: z.number().int().positive().default(10_000),
});
export type IpcConnectionConfig = z.infer<typeof IpcConnectionConfigSchema>;
