import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  AgentEventStore,
  StateRecoveryManager,
  DualBufferQueue,
} from "../src/index.js";
import { SteeringInputEvent } from "@krypton/shared-types";

describe("Phase 2 Verification Gate: Event Store, Recovery & Steering Queue", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-event-test-"));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }
  });

  it("appends and rehydrates events atomically with correct sequence numbers", async () => {
    const store = new AgentEventStore("test-agent", tempRoot);
    const agentId = "11111111-1111-4111-a111-111111111111";

    const ev1 = await store.appendEvent({
      agentId,
      eventType: "AgentSpawned",
      payload: { role: "coder" },
    });
    expect(ev1.sequenceNumber).toBe(1);

    const ev2 = await store.appendEvent({
      agentId,
      eventType: "ToolExecuting",
      payload: { toolName: "compile", taskId: "task-1" },
    });
    expect(ev2.sequenceNumber).toBe(2);

    const events = await store.readEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.eventType).toBe("AgentSpawned");
    expect(events[1]?.eventType).toBe("ToolExecuting");
  });

  it("recovers interrupted agent state from events.jsonl", async () => {
    const store = new AgentEventStore("crashed-agent", tempRoot);
    const agentId = "11111111-1111-4111-a111-111111111111";

    await store.appendEvent({
      agentId,
      eventType: "AgentSpawned",
      payload: {},
    });

    await store.appendEvent({
      agentId,
      eventType: "ToolExecuting",
      payload: { taskId: "incomplete-task-99", worktreePath: "/tmp/worktree" },
    });

    const recovery = new StateRecoveryManager(tempRoot);
    const recovered = await recovery.recoverAgent("crashed-agent");

    expect(recovered).not.toBeNull();
    expect(recovered?.hasIncompleteTask).toBe(true);
    expect(recovered?.lastActiveTaskId).toBe("incomplete-task-99");
    expect(recovered?.activeWorktreePath).toBe("/tmp/worktree");
    expect(recovered?.lastState).toBe("executing");
  });

  it("prioritizes steering interrupt events in DualBufferQueue", () => {
    const queue = new DualBufferQueue<string>();

    queue.enqueuePrimary("step-1");
    queue.enqueuePrimary("step-2");

    const steering: SteeringInputEvent = {
      type: "steering_input",
      instruction: "Stop and run unit tests first",
      source: "voice_hud",
      priority: "immediate",
      timestamp: Date.now(),
    };

    queue.enqueueSteering(steering);
    expect(queue.hasSteeringInterrupt()).toBe(true);

    const first = queue.dequeue();
    expect(first.steering).toBeDefined();
    expect(first.steering?.instruction).toBe("Stop and run unit tests first");

    const second = queue.dequeue();
    expect(second.primaryItem).toBe("step-1");
  });
});
