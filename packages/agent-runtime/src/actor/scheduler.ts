import { EventEmitter } from "node:events";
import { TokenBudget } from "@krypton/shared-types";

export class RecursionCeilingExceededError extends Error {
  constructor(depth: number, maxDepth: number) {
    super(
      `Recursion ceiling exceeded: sub-agent depth ${depth} reaches or exceeds max allowed depth of ${maxDepth}`
    );
    this.name = "RecursionCeilingExceededError";
  }
}

export class TokenBudgetExhaustedError extends Error {
  constructor(agentId: string, requestedOrUsed: number, hardLimit: number) {
    super(
      `Token budget exhausted for agent ${agentId}: token usage (${requestedOrUsed}) exceeds hard limit (${hardLimit})`
    );
    this.name = "TokenBudgetExhaustedError";
  }
}

export class ConcurrencyQueueAbortedError extends Error {
  constructor(reason?: string) {
    super(`Concurrency queue wait aborted: ${reason || "parent task canceled"}`);
    this.name = "ConcurrencyQueueAbortedError";
  }
}

export interface ScheduledActor {
  agentId: string;
  name: string;
  depth: number;
  tokenBudget: TokenBudget;
  abortController: AbortController;
  parentAgentId?: string | null;
  startedAt: number;
}

export interface SchedulerConfig {
  maxDepth?: number;
  maxConcurrency?: number;
  defaultTimeoutMs?: number;
}

/**
 * Hierarchical Scheduler & Budget Governor
 * Enforces:
 * 1. Hard recursion limit (depth <= 3)
 * 2. Global concurrency cap (max 5 active concurrent sub-agents)
 * 3. Token budget enforcement with auto-kill when exhausted
 * 4. Parent-controlled AbortController timeout (default 60s per child task)
 */
export class ActorScheduler extends EventEmitter {
  private static instance: ActorScheduler | null = null;

  public readonly maxDepth: number;
  public readonly maxConcurrency: number;
  public readonly defaultTimeoutMs: number;

  private activeActors = new Map<string, ScheduledActor>();
  private waitingQueue: Array<{
    id: string;
    resolve: () => void;
    reject: (err: Error) => void;
    abortHandler?: () => void;
    signal?: AbortSignal;
  }> = [];

  constructor(config?: SchedulerConfig) {
    super();
    this.maxDepth = config?.maxDepth ?? 3;
    this.maxConcurrency = config?.maxConcurrency ?? 5;
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 60_000;
  }

  public static getInstance(config?: SchedulerConfig): ActorScheduler {
    if (!ActorScheduler.instance) {
      ActorScheduler.instance = new ActorScheduler(config);
    }
    return ActorScheduler.instance;
  }

  public static resetInstance(): void {
    if (ActorScheduler.instance) {
      ActorScheduler.instance.reset();
      ActorScheduler.instance = null;
    }
  }

  public getActiveCount(): number {
    return this.activeActors.size;
  }

  public getQueueLength(): number {
    return this.waitingQueue.length;
  }

  public getActiveActor(agentId: string): ScheduledActor | undefined {
    return this.activeActors.get(agentId);
  }

  /**
   * Validates if an agent at `currentDepth` is allowed to spawn a child.
   */
  public canSpawnChild(currentDepth: number): { allowed: boolean; reason?: string } {
    if (currentDepth >= this.maxDepth) {
      return {
        allowed: false,
        reason: `Current recursion depth ${currentDepth} reaches or exceeds max limit of ${this.maxDepth}`,
      };
    }
    return { allowed: true };
  }

  /**
   * Acquires a concurrency slot under the global concurrency ceiling (max 5).
   * If all 5 slots are occupied, queues request until a slot is freed.
   */
  public async acquireSlot(parentSignal?: AbortSignal): Promise<void> {
    if (parentSignal?.aborted) {
      throw new ConcurrencyQueueAbortedError(
        typeof parentSignal.reason === "string" ? parentSignal.reason : undefined
      );
    }

    if (this.activeActors.size < this.maxConcurrency) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const waitId = crypto.randomUUID();

      let abortHandler: (() => void) | undefined;
      if (parentSignal) {
        abortHandler = () => {
          const index = this.waitingQueue.findIndex((item) => item.id === waitId);
          if (index !== -1) {
            this.waitingQueue.splice(index, 1);
          }
          reject(
            new ConcurrencyQueueAbortedError(
              typeof parentSignal.reason === "string"
                ? parentSignal.reason
                : undefined
            )
          );
        };
        parentSignal.addEventListener("abort", abortHandler, { once: true });
      }

      this.waitingQueue.push({
        id: waitId,
        resolve: () => {
          if (parentSignal && abortHandler) {
            parentSignal.removeEventListener("abort", abortHandler);
          }
          resolve();
        },
        reject,
        abortHandler,
        signal: parentSignal,
      });

      this.emit("taskQueued", { queueLength: this.waitingQueue.length });
    });
  }

  /**
   * Releases a concurrency slot and unblocks the next queued sub-agent.
   */
  private drainQueue(): void {
    while (
      this.waitingQueue.length > 0 &&
      this.activeActors.size < this.maxConcurrency
    ) {
      const next = this.waitingQueue.shift();
      if (!next) break;

      if (next.signal?.aborted) {
        // Skip already aborted queue entries
        continue;
      }

      next.resolve();
      this.emit("taskDequeued", { queueLength: this.waitingQueue.length });
      break;
    }
  }

  /**
   * Registers a running actor in the active pool.
   */
  public registerActor(actor: ScheduledActor): void {
    this.activeActors.set(actor.agentId, actor);
    this.emit("actorRegistered", {
      agentId: actor.agentId,
      depth: actor.depth,
      activeCount: this.activeActors.size,
    });
  }

  /**
   * Unregisters an actor upon completion or failure and drains the queue.
   */
  public releaseActor(agentId: string): void {
    const existing = this.activeActors.get(agentId);
    if (existing) {
      this.activeActors.delete(agentId);
      this.emit("actorReleased", {
        agentId,
        activeCount: this.activeActors.size,
      });
      this.drainQueue();
    }
  }

  /**
   * Deducts tokens from an actor's budget.
   * Throws TokenBudgetExhaustedError and aborts the agent's controller if budget is exhausted.
   */
  public deductTokens(agentId: string, tokens: number): TokenBudget {
    const actor = this.activeActors.get(agentId);
    if (!actor) {
      throw new Error(`Actor ${agentId} is not registered in scheduler`);
    }

    const budget = actor.tokenBudget;
    const newUsage = budget.usedTokens + tokens;

    if (newUsage > budget.hardLimit) {
      budget.usedTokens = budget.hardLimit;
      actor.abortController.abort(
        new TokenBudgetExhaustedError(agentId, newUsage, budget.hardLimit)
      );
      this.emit("budgetExhausted", {
        agentId,
        hardLimit: budget.hardLimit,
        attemptedTokens: newUsage,
      });
      throw new TokenBudgetExhaustedError(agentId, newUsage, budget.hardLimit);
    }

    budget.usedTokens = newUsage;

    // Check warning threshold
    if (newUsage / budget.hardLimit >= budget.warningThreshold) {
      this.emit("budgetWarning", {
        agentId,
        usedTokens: newUsage,
        hardLimit: budget.hardLimit,
        ratio: newUsage / budget.hardLimit,
      });
    }

    return budget;
  }

  /**
   * Creates a child AbortController bound to both parent abort signals and a timeout.
   */
  public createChildAbortController(
    parentSignal?: AbortSignal,
    timeoutMs?: number
  ): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    let timeoutId: NodeJS.Timeout | null = null;
    if (timeout > 0 && timeout < Infinity) {
      timeoutId = setTimeout(() => {
        controller.abort(
          new Error(`Child sub-agent task timed out after ${timeout}ms`)
        );
      }, timeout);
    }

    let parentAbortHandler: (() => void) | null = null;
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason);
      } else {
        parentAbortHandler = () => {
          controller.abort(parentSignal.reason);
        };
        parentSignal.addEventListener("abort", parentAbortHandler, { once: true });
      }
    }

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (parentSignal && parentAbortHandler) {
        parentSignal.removeEventListener("abort", parentAbortHandler);
      }
    };

    return { controller, cleanup };
  }

  /**
   * Resets scheduler state, clearing active actors and waiting queues.
   */
  public reset(): void {
    for (const actor of this.activeActors.values()) {
      actor.abortController.abort(new Error("Scheduler reset"));
    }
    this.activeActors.clear();

    while (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift();
      next?.reject(new Error("Scheduler reset"));
    }
  }
}
