import { describe, it, expect, beforeEach } from "vitest";
import {
  PromptBus,
  ChannelTransportHandler,
} from "../src/interaction/prompt-bus.js";
import {
  ClarificationResolver,
  ClarificationTimeoutError,
} from "../src/interaction/resolver.js";
import {
  ClarificationCancelation,
  ClarificationRequest,
} from "@krypton/shared-types";

class MockChannelTransport implements ChannelTransportHandler {
  public receivedRequests: ClarificationRequest[] = [];
  public receivedCancelations: ClarificationCancelation[] = [];

  constructor(public readonly channel: any) {}

  async dispatch(request: ClarificationRequest): Promise<void> {
    this.receivedRequests.push(request);
  }

  async cancel(cancelation: ClarificationCancelation): Promise<void> {
    this.receivedCancelations.push(cancelation);
  }
}

describe("Human-in-the-Loop Clarification Bus & Multi-Channel Resolver", () => {
  let bus: PromptBus;
  let resolver: ClarificationResolver;
  let desktopTransport: MockChannelTransport;
  let cliTransport: MockChannelTransport;
  let telegramTransport: MockChannelTransport;

  beforeEach(() => {
    bus = new PromptBus();
    resolver = new ClarificationResolver(bus);

    desktopTransport = new MockChannelTransport("desktop_ui");
    cliTransport = new MockChannelTransport("cli");
    telegramTransport = new MockChannelTransport("telegram");

    bus.registerTransport(desktopTransport);
    bus.registerTransport(cliTransport);
    bus.registerTransport(telegramTransport);
  });

  it("broadcasts request to all channels, resolves on first response, and cancels sibling channels", async () => {
    const agentId = "77777777-7777-7777-7777-777777777777";

    // Start clarification request in background
    const requestPromise = resolver.requestClarification({
      agentId,
      prompt: "Which database migration strategy should be executed?",
      options: [
        { id: "opt_safe", label: "Safe Zero-Downtime Migration", isRecommended: true },
        { id: "opt_fast", label: "Direct Truncate & Migrate", isRecommended: false },
      ],
      allowFreeform: true,
      timeoutMs: 5000,
    });

    // Verify all 3 channels received the question
    expect(desktopTransport.receivedRequests).toHaveLength(1);
    expect(cliTransport.receivedRequests).toHaveLength(1);
    expect(telegramTransport.receivedRequests).toHaveLength(1);

    const requestId = desktopTransport.receivedRequests[0].requestId;
    expect(resolver.getPendingCount()).toBe(1);

    // User responds via CLI first
    const resolved = await resolver.resolveResponse({
      requestId,
      selectedOptionIds: ["opt_safe"],
      freeformText: "Please also create a rollback script",
      respondingChannel: "cli",
      timestamp: Date.now(),
    });

    expect(resolved).toBe(true);

    // Agent promise unblocks with response
    const answer = await requestPromise;
    expect(answer.selectedOptionIds).toEqual(["opt_safe"]);
    expect(answer.freeformText).toBe("Please also create a rollback script");
    expect(answer.respondingChannel).toBe("cli");

    // Sibling channels must have received cancelation tokens
    expect(desktopTransport.receivedCancelations).toHaveLength(1);
    expect(desktopTransport.receivedCancelations[0].resolvedByChannel).toBe("cli");
    expect(telegramTransport.receivedCancelations).toHaveLength(1);

    // Duplicate answer from another channel must be rejected / ignored
    const lateResponse = await resolver.resolveResponse({
      requestId,
      selectedOptionIds: ["opt_fast"],
      respondingChannel: "desktop_ui",
      timestamp: Date.now(),
    });
    expect(lateResponse).toBe(false);
    expect(resolver.getPendingCount()).toBe(0);
  });

  it("handles request timeout and broadcasts cancelation", async () => {
    const agentId = "88888888-8888-8888-8888-888888888888";

    // 50ms quick timeout
    await expect(
      resolver.requestClarification({
        agentId,
        prompt: "Will timeout quickly",
        timeoutMs: 50,
      })
    ).rejects.toThrow(ClarificationTimeoutError);

    // Verify cancelation was dispatched to all channels
    expect(desktopTransport.receivedCancelations).toHaveLength(1);
    expect(desktopTransport.receivedCancelations[0].reason).toContain("Timed out");
    expect(resolver.getPendingCount()).toBe(0);
  });
});
