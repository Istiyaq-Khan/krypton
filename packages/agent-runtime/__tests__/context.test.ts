import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Message } from "@krypton/shared-types";
import {
  ObservationOffloader,
  ContextCondenser,
  estimateMessagesTokenCount,
} from "../src/index.js";

describe("Phase 2 Verification Gate: Context Optimization & Offloading", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-context-test-"));
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

  it("passes through small outputs without offloading to disk", () => {
    const offloader = new ObservationOffloader({
      customRoot: tempRoot,
      maxByteThreshold: 1000,
    });
    const smallOutput = "Line 1\nLine 2\nLine 3";

    const result = offloader.offloadIfNeeded(smallOutput, "step-1");
    expect(result.isOffloaded).toBe(false);
    expect(result.content).toBe(smallOutput);
    expect(result.offloadDiskPath).toBeUndefined();
  });

  it("offloads output exceeding threshold to disk and generates head/tail summary", () => {
    const offloader = new ObservationOffloader({
      customRoot: tempRoot,
      maxByteThreshold: 1000,
      headLines: 5,
      tailLines: 5,
    });

    // Generate ~100 lines of output (>2KB)
    const lines: string[] = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`Log trace line ${i}: detailed diagnostic payload data...`);
    }
    const largeOutput = lines.join("\n");

    const result = offloader.offloadIfNeeded(largeOutput, "step-large-102");
    expect(result.isOffloaded).toBe(true);
    expect(result.offloadDiskPath).toBeDefined();
    expect(fs.existsSync(result.offloadDiskPath!)).toBe(true);

    // Verify raw file contains full output
    const diskContent = fs.readFileSync(result.offloadDiskPath!, "utf-8");
    expect(diskContent).toBe(largeOutput);

    // Verify summary contains head, tail, and truncation note
    expect(result.content).toContain("[OUTPUT OFFLOADED TO DISK:");
    expect(result.content).toContain("Log trace line 1:");
    expect(result.content).toContain("Log trace line 100:");
    expect(result.content).toContain("--- TRUNCATED (90 lines omitted) ---");
  });

  it("triggers context compaction when utilization exceeds 90%", () => {
    // Context window of 1,000 tokens
    const condenser = new ContextCondenser(1000, 0.9);

    // Build messages exceeding 900 tokens (~3600 chars)
    const longTurn = "x".repeat(3800);
    const messages: Message[] = [
      { role: "system", content: "You are an autonomous agent.", timestamp: 1 },
      { role: "user", content: "Build the application.", timestamp: 2 },
      { role: "assistant", content: longTurn, timestamp: 3 },
      { role: "user", content: "Next command.", timestamp: 4 },
    ];

    expect(condenser.shouldCompact(messages)).toBe(true);

    const compacted = condenser.compact(messages, {
      objective: "Build the application.",
      taskDagSummary: "Task 1: Complete\nTask 2: In Progress",
      activeDiffsSummary: "+ added index.ts",
      recentTurnsToKeep: 1,
    });

    expect(compacted.compacted).toBe(true);
    expect(compacted.compactedMessageCount).toBeLessThan(messages.length);
    expect(compacted.estimatedTokensAfter).toBeLessThan(compacted.estimatedTokensBefore);

    // Ensure system prompt and checkpoint are preserved
    expect(compacted.messages[0]?.role).toBe("system");
    expect(compacted.messages[1]?.content).toContain("[STATE CHECKPOINT: COMPACTED CONTEXT]");
    expect(compacted.messages[1]?.content).toContain("Task 1: Complete");
  });
});
