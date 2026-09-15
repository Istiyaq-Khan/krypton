import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SandboxRunner } from "../src/index.js";

describe("Phase 2 Verification Gate: Sandbox Subprocess Runner", () => {
  let tempRoot: string;
  let runner: SandboxRunner;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-sandbox-test-"));
    runner = new SandboxRunner(tempRoot);
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

  it("successfully executes a harmless script and returns output", async () => {
    const result = await runner.execute({
      toolName: "calculator",
      language: "javascript",
      code: "console.log('Result:', 21 * 2);",
      customRoot: tempRoot,
      timeoutMs: 5000,
    });

    expect(result.isError).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Result: 42");
  });

  it("enforces execution timeout and terminates runaway scripts", async () => {
    const infiniteLoopCode = `
      const startTime = Date.now();
      while (true) {
        // Run forever
      }
    `;

    const result = await runner.execute({
      toolName: "hang_script",
      language: "javascript",
      code: infiniteLoopCode,
      customRoot: tempRoot,
      timeoutMs: 800, // Short timeout
    });

    expect(result.isError).toBe(true);
    expect(result.stderr).toContain("Execution timed out");
  });

  it("captures execution errors cleanly without crashing", async () => {
    const failingCode = `
      throw new Error("Deliberate sandbox failure");
    `;

    const result = await runner.execute({
      toolName: "failing_script",
      language: "javascript",
      code: failingCode,
      customRoot: tempRoot,
      timeoutMs: 5000,
    });

    expect(result.isError).toBe(true);
    expect(result.stderr).toContain("Deliberate sandbox failure");
  });
});
