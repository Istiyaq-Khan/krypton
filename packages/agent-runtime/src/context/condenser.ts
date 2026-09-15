import { Message } from "@krypton/shared-types";

export interface CompactionOptions {
  objective: string;
  taskDagSummary?: string;
  activeDiffsSummary?: string;
  recentTurnsToKeep?: number; // default 3
}

export interface CompactionResult {
  compacted: boolean;
  originalMessageCount: number;
  compactedMessageCount: number;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  messages: Message[];
}

/**
 * Estimates token count from a text string (~4 characters per token heuristic).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimates total tokens used across an array of universal Messages.
 */
export function estimateMessagesTokenCount(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokenCount(msg.content);
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += estimateTokenCount(tc.name) + estimateTokenCount(JSON.stringify(tc.arguments));
      }
    }
    if (msg.toolResults) {
      for (const tr of msg.toolResults) {
        total += estimateTokenCount(tr.content);
      }
    }
  }
  return total;
}

/**
 * Monitors context window utilization and condenses history when exceeding threshold (default 90%).
 */
export class ContextCondenser {
  private readonly contextWindowLimit: number;
  private readonly compactionThreshold: number;

  constructor(contextWindowLimit = 128_000, compactionThreshold = 0.9) {
    this.contextWindowLimit = contextWindowLimit;
    this.compactionThreshold = compactionThreshold;
  }

  /**
   * Calculates the current context token utilization ratio (0.0 to 1.0+).
   */
  public getUtilization(messages: Message[]): number {
    const currentTokens = estimateMessagesTokenCount(messages);
    return currentTokens / this.contextWindowLimit;
  }

  /**
   * Checks if context utilization exceeds the compaction threshold (90%).
   */
  public shouldCompact(messages: Message[]): boolean {
    return this.getUtilization(messages) >= this.compactionThreshold;
  }

  /**
   * Condenses conversation history by collapsing past intermediate tool cycles
   * into an immutable distilled state checkpoint turn while preserving recent context.
   */
  public compact(messages: Message[], options: CompactionOptions): CompactionResult {
    const estimatedTokensBefore = estimateMessagesTokenCount(messages);

    if (!this.shouldCompact(messages) && messages.length <= 10) {
      return {
        compacted: false,
        originalMessageCount: messages.length,
        compactedMessageCount: messages.length,
        estimatedTokensBefore,
        estimatedTokensAfter: estimatedTokensBefore,
        messages,
      };
    }

    const recentCount = options.recentTurnsToKeep ?? 3;
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const recentMessages = nonSystem.slice(-recentCount);

    // Build synthesized checkpoint message
    const checkpointContent = [
      `[STATE CHECKPOINT: COMPACTED CONTEXT]`,
      `Objective: ${options.objective}`,
      options.taskDagSummary ? `Active Task DAG:\n${options.taskDagSummary}` : "",
      options.activeDiffsSummary ? `Verified Code Diffs:\n${options.activeDiffsSummary}` : "",
      `Note: Intermediate verbose conversation turns prior to this checkpoint have been purged to conserve context window.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const checkpointMessage: Message = {
      role: "assistant",
      content: checkpointContent,
      timestamp: Date.now(),
    };

    const compactedMessages: Message[] = [
      ...systemMessages,
      checkpointMessage,
      ...recentMessages,
    ];

    const estimatedTokensAfter = estimateMessagesTokenCount(compactedMessages);

    return {
      compacted: true,
      originalMessageCount: messages.length,
      compactedMessageCount: compactedMessages.length,
      estimatedTokensBefore,
      estimatedTokensAfter,
      messages: compactedMessages,
    };
  }
}
