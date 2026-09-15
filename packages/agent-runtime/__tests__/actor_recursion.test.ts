import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Agent } from "../src/actor/agent.js";
import {
  ActorScheduler,
  RecursionCeilingExceededError,
  TokenBudgetExhaustedError,
} from "../src/actor/scheduler.js";
import { AgentStateManager } from "../src/actor/state.js";
import { LLMProvider, GenerateOptions, GenerateResult } from "../src/providers/types.js";

class MockProvider implements LLMProvider {
  public readonly providerId = "mock";
  public readonly model = "mock-model";
  public callCount = 0;
  public tokensPerCall = 500;

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    this.callCount++;
    return {
      message: {
        id: "msg-1",
        role: "assistant",
        content: "Mock response",
        timestamp: Date.now(),
      },
      toolCalls: [],
      usage: {
        promptTokens: 200,
        completionTokens: this.tokensPerCall - 200,
        totalTokens: this.tokensPerCall,
      },
    };
  }
}

describe("Actor Engine & Scheduler - Recursion, Concurrency & Budget Defense", () => {
  let tempDir: string;
  let scheduler: ActorScheduler;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-actor-test-"));
    ActorScheduler.resetInstance();
    scheduler = new ActorScheduler({
      maxDepth: 3,
      maxConcurrency: 5,
      defaultTimeoutMs: 2000,
    });
  });

  afterEach(() => {
    scheduler.reset();
    ActorScheduler.resetInstance();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("enforces strict recursion ceiling at depth 3", async () => {
    // Root agent (depth 0)
    const rootAgent = new Agent({
      name: "root",
      recursionDepth: 0,
      customRoot: tempDir,
      scheduler,
    });
    expect(rootAgent.context.recursionDepth).toBe(0);

    // Child 1 (depth 1)
    const child1 = await rootAgent.spawnChild({
      role: "researcher",
      taskDescription: "Perform deep research",
    });
    expect(child1.context.recursionDepth).toBe(1);

    // Child 2 (depth 2)
    const child2 = await child1.spawnChild({
      role: "scraper",
      taskDescription: "Scrape search results",
    });
    expect(child2.context.recursionDepth).toBe(2);

    // Child 3 (depth 3)
    const child3 = await child2.spawnChild({
      role: "parser",
      taskDescription: "Parse DOM nodes",
    });
    expect(child3.context.recursionDepth).toBe(3);

    // Child 4 attempt at depth 3 must be rejected
    await expect(
      child3.spawnChild({
        role: "sub_parser",
        taskDescription: "This must fail",
      })
    ).rejects.toThrow(RecursionCeilingExceededError);
  });

  it("enforces global concurrency cap of 5 and queues surplus sub-agents", async () => {
    const rootAgent = new Agent({
      name: "concurrency_root",
      customRoot: tempDir,
      scheduler,
    });

    const children: Agent[] = [];

    // Spawn 5 concurrent sub-agents (reaches max cap)
    for (let i = 0; i < 5; i++) {
      const child = await rootAgent.spawnChild({
        role: `worker_${i}`,
        taskDescription: `Task ${i}`,
      });
      children.push(child);
    }

    expect(scheduler.getActiveCount()).toBe(5);
    expect(scheduler.getQueueLength()).toBe(0);

    // 6th spawn must be queued
    let queuedResolved = false;
    const sixthSpawnPromise = rootAgent
      .spawnChild({
        role: "worker_queued",
        taskDescription: "Task Queued",
      })
      .then((child) => {
        queuedResolved = true;
        return child;
      });

    // Give small tick to enter queue
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scheduler.getQueueLength()).toBe(1);
    expect(queuedResolved).toBe(false);

    // Release one of the active children
    await children[0].stateManager.transitionTo("completed");

    // The queued child should now acquire the slot and resolve
    const child6 = await sixthSpawnPromise;
    expect(queuedResolved).toBe(true);
    expect(child6).toBeDefined();
    expect(scheduler.getQueueLength()).toBe(0);
    expect(scheduler.getActiveCount()).toBe(5);
  });

  it("halts child execution cleanly when token budget is exhausted", async () => {
    const provider = new MockProvider();
    provider.tokensPerCall = 2500; // Exceeds child's 2000 budget

    const root = new Agent({
      name: "budget_root",
      customRoot: tempDir,
      scheduler,
      tokenBudget: { hardLimit: 5000, usedTokens: 0 },
    });

    // Spawn child with strict 2,000 token budget
    const child = await root.spawnChild({
      role: "budget_constrained_child",
      taskDescription: "Run steps until exhausted",
      budgetAllocation: 2000,
      provider,
    });

    // Step: provider consumes 2500 tokens -> exceeds 2000 limit -> transitions child to aborted
    const stepRes = await child.step();
    expect(stepRes.state).toBe("aborted");
    expect(stepRes.terminal).toBe(true);
    expect(child.getState()).toBe("aborted");
  });

  it("distills long-term memory into MEMORY.md on task completion", async () => {
    const stateManager = new AgentStateManager({
      agentId: crypto.randomUUID(),
      agentName: "memory_bot",
      initialState: "idle",
      customRoot: tempDir,
    });

    await stateManager.distillMemory([
      "User prefers Next.js over vanilla React.",
      "Database connection requires SSL mode.",
    ]);

    const memoryFile = path.join(tempDir, "agents", "memory_bot", "MEMORY.md");
    expect(fs.existsSync(memoryFile)).toBe(true);

    const content = fs.readFileSync(memoryFile, "utf-8");
    expect(content).toContain("User prefers Next.js over vanilla React.");
    expect(content).toContain("Database connection requires SSL mode.");
  });
});
