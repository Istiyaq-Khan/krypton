import { z } from "zod";
import {
  ChoiceOption,
  ChoiceOptionSchema,
  ClarificationCancelation,
  ClarificationRequest,
  ClarificationRequestSchema,
  ClarificationResponse,
  ClarificationResponseSchema,
  InteractionChannel,
} from "@krypton/shared-types";
import { PromptBus } from "./prompt-bus.js";

export class ClarificationTimeoutError extends Error {
  constructor(requestId: string, timeoutMs: number) {
    super(`Clarification request '${requestId}' timed out after ${timeoutMs}ms`);
    this.name = "ClarificationTimeoutError";
  }
}

export class ClarificationCanceledError extends Error {
  constructor(requestId: string, reason?: string) {
    super(`Clarification request '${requestId}' was canceled: ${reason || "User aborted"}`);
    this.name = "ClarificationCanceledError";
  }
}

export type ChoiceOptionInput = z.input<typeof ChoiceOptionSchema>;

export interface RequestClarificationOptions {
  agentId: string;
  taskId?: string;
  prompt: string;
  options?: ChoiceOptionInput[];
  allowFreeform?: boolean;
  timeoutMs?: number;
}

interface PendingClarification {
  request: ClarificationRequest;
  resolve: (response: ClarificationResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Asynchronous Clarification Resolver.
 * Blocks agent execution promises awaiting user clarification across channels.
 * Resolves upon the first valid response from any channel and dispatches
 * cancelation tokens to all other channels immediately.
 */
export class ClarificationResolver {
  private readonly promptBus: PromptBus;
  private pending = new Map<string, PendingClarification>();

  constructor(promptBus: PromptBus) {
    this.promptBus = promptBus;
  }

  public getPendingCount(): number {
    return this.pending.size;
  }

  public hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /**
   * Dispatches a structured question and blocks until the first channel responds.
   */
  public async requestClarification(
    options: RequestClarificationOptions
  ): Promise<ClarificationResponse> {
    const requestId = crypto.randomUUID();
    const timeoutMs = options.timeoutMs ?? 120_000;

    const request: ClarificationRequest = ClarificationRequestSchema.parse({
      requestId,
      agentId: options.agentId,
      taskId: options.taskId,
      prompt: options.prompt,
      options: options.options ?? [],
      allowFreeform: options.allowFreeform ?? true,
      timeoutMs,
      status: "pending",
      createdAt: Date.now(),
    });

    return new Promise<ClarificationResponse>((resolve, reject) => {
      const timer = setTimeout(async () => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          request.status = "timed_out";

          // Broadcast cancelation to channels
          const cancelation: ClarificationCancelation = {
            requestId,
            reason: `Timed out after ${timeoutMs}ms`,
            timestamp: Date.now(),
          };
          await this.promptBus.broadcastCancelation(cancelation);

          reject(new ClarificationTimeoutError(requestId, timeoutMs));
        }
      }, timeoutMs);

      this.pending.set(requestId, {
        request,
        resolve,
        reject,
        timer,
      });

      // Broadcast to all listening channels
      this.promptBus.broadcastRequest(request).catch((err) => {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(err);
      });
    });
  }

  /**
   * Resolves a pending question with a response from any channel.
   * First valid response unblocks the agent and cancels prompts on sibling channels.
   */
  public async resolveResponse(
    responsePayload: ClarificationResponse
  ): Promise<boolean> {
    const validated = ClarificationResponseSchema.parse(responsePayload);
    const item = this.pending.get(validated.requestId);

    if (!item) {
      return false; // Already resolved, timed out, or canceled
    }

    clearTimeout(item.timer);
    this.pending.delete(validated.requestId);
    item.request.status = "resolved";

    // Unblock the agent execution promise
    item.resolve(validated);

    // Cancel sibling channels
    const cancelation: ClarificationCancelation = {
      requestId: validated.requestId,
      reason: `Resolved by ${validated.respondingChannel}`,
      resolvedByChannel: validated.respondingChannel,
      timestamp: Date.now(),
    };
    await this.promptBus.broadcastCancelation(cancelation);

    return true;
  }

  /**
   * Cancels a pending request explicitly.
   */
  public async cancelRequest(requestId: string, reason = "Aborted"): Promise<boolean> {
    const item = this.pending.get(requestId);
    if (!item) return false;

    clearTimeout(item.timer);
    this.pending.delete(requestId);
    item.request.status = "canceled";

    item.reject(new ClarificationCanceledError(requestId, reason));

    const cancelation: ClarificationCancelation = {
      requestId,
      reason,
      timestamp: Date.now(),
    };
    await this.promptBus.broadcastCancelation(cancelation);

    return true;
  }
}
