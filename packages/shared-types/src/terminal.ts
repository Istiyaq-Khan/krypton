import { z } from "zod";

/**
 * Configuration for spawning a persistent interactive pseudo-terminal session.
 */
export const PtySessionConfigSchema = z.object({
  sessionId: z.string().uuid().default(() => crypto.randomUUID()),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).default({}),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
  logPath: z.string().optional(),
});
export type PtySessionConfig = z.infer<typeof PtySessionConfigSchema>;

/**
 * Status information for an active or completed PTY session.
 */
export const PtySessionInfoSchema = z.object({
  sessionId: z.string().uuid(),
  pid: z.number().int().positive().optional(),
  command: z.string(),
  status: z.enum(["running", "exited", "terminated", "failed"]),
  exitCode: z.number().int().nullable().default(null),
  startedAt: z.number().int().nonnegative().default(() => Date.now()),
  endedAt: z.number().int().nonnegative().optional(),
  logPath: z.string(),
});
export type PtySessionInfo = z.infer<typeof PtySessionInfoSchema>;

/**
 * Streaming terminal output chunk containing raw ANSI and cleaned plain text.
 */
export const PtyOutputEventSchema = z.object({
  sessionId: z.string().uuid(),
  raw: z.string(),
  cleaned: z.string(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type PtyOutputEvent = z.infer<typeof PtyOutputEventSchema>;
