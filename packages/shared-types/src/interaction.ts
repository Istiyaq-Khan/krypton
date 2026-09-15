import { z } from "zod";

/**
 * All supported interaction channels across the Krypton runtime.
 */
export const InteractionChannelSchema = z.enum([
  "desktop_ui",
  "cli",
  "voice_hud",
  "telegram",
  "discord",
  "whatsapp",
  "slack",
  "signal",
]);
export type InteractionChannel = z.infer<typeof InteractionChannelSchema>;

/**
 * Predefined choice option presented during human-in-the-loop clarification.
 */
export const ChoiceOptionSchema = z.object({
  id: z.string().min(1, "Option ID is required"),
  label: z.string().min(1, "Option label is required"),
  description: z.string().optional(),
  hotkey: z.string().optional(),
  isRecommended: z.boolean().default(false),
});
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

/**
 * Structured clarification request dispatched when an agent encounters ambiguity.
 */
export const ClarificationRequestSchema = z.object({
  requestId: z.string().uuid().default(() => crypto.randomUUID()),
  agentId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  prompt: z.string().min(1, "Clarification prompt is required"),
  options: z.array(ChoiceOptionSchema).default([]),
  allowFreeform: z.boolean().default(true),
  timeoutMs: z.number().int().positive().default(120_000),
  status: z
    .enum(["pending", "resolved", "timed_out", "canceled"])
    .default("pending"),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;

/**
 * User response resolving a pending clarification request.
 */
export const ClarificationResponseSchema = z.object({
  requestId: z.string().uuid(),
  selectedOptionIds: z.array(z.string()).default([]),
  freeformText: z.string().optional(),
  respondingChannel: InteractionChannelSchema,
  responderId: z.string().optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>;

/**
 * Broadcast event sent to cancel open prompts across sibling channels once answered.
 */
export const ClarificationCancelationSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().default("Resolved by another channel"),
  resolvedByChannel: InteractionChannelSchema.optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
});
export type ClarificationCancelation = z.infer<
  typeof ClarificationCancelationSchema
>;
