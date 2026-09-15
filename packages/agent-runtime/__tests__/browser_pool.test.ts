import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { BrowserContextPool } from "../src/browser/browser.js";
import { MouseHumanizer, KeystrokeHumanizer } from "../src/browser/humanizer.js";

describe("Phase 4 Verification Gate: Browser Context Pool & Stealth Evasions", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = path.join(os.tmpdir(), `krypton-test-browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempRoot)) {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      } catch {}
    }
  });

  it("strictly enforces maxContexts cap of 2 during 10 sequential browser acquisitions and recycles idle memory", async () => {
    const pool = new BrowserContextPool({
      maxContexts: 2,
      idleTimeoutMs: 50, // 50ms for test
      customRoot: tempRoot,
      autoCheckIntervalMs: 0,
    });

    const acquiredIds: string[] = [];

    // Launch 10 sequential browser context requests
    for (let i = 0; i < 10; i++) {
      const handle = await pool.acquireContext({ contextId: `session_${i}` });
      acquiredIds.push(handle.id);

      const stats = pool.getStats();
      // Active context count must NEVER exceed 2 at any point
      expect(stats.activeContextCount).toBeLessThanOrEqual(2);
      expect(stats.maxContexts).toBe(2);
    }

    const finalStats = pool.getStats();
    expect(finalStats.activeContextCount).toBe(2);
    // 8 contexts must have been recycled to stay within the cap of 2
    expect(finalStats.recycledCount).toBe(8);

    // Verify persistent state files exist in browser_profiles/default
    const profileDir = path.join(tempRoot, "browser_profiles", "default");
    expect(fs.existsSync(profileDir)).toBe(true);

    // Test idle recycling
    await new Promise((resolve) => setTimeout(resolve, 80));
    const recycledIdle = await pool.recycleIdleContexts();
    expect(recycledIdle).toBe(2);
    expect(pool.getStats().activeContextCount).toBe(0);

    await pool.shutdown();
  });

  it("provides anti-bot stealth scripts and randomized realistic desktop viewports", () => {
    const stealthScript = BrowserContextPool.getStealthScripts();
    expect(stealthScript).toContain("navigator");
    expect(stealthScript).toContain("webdriver");
    expect(stealthScript).toContain("UNMASKED_VENDOR_WEBGL");
    expect(stealthScript).toContain("Intel Inc.");
    expect(stealthScript).toContain("AudioBuffer");
    expect(stealthScript).toContain("Chrome PDF Viewer");

    const viewport = BrowserContextPool.getRandomDesktopViewport();
    expect(viewport.width).toBeGreaterThanOrEqual(1366);
    expect(viewport.width).toBeLessThanOrEqual(1920);
    expect(viewport.height).toBeGreaterThanOrEqual(768);
    expect(viewport.height).toBeLessThanOrEqual(1080);
  });

  it("generates natural cubic Bézier mouse trajectories with overshoot and jitter", () => {
    const start = { x: 50, y: 50 };
    const target = { x: 600, y: 400 };

    const trajectory = MouseHumanizer.generateTrajectory(start, target, {
      steps: 25,
      overshoot: true,
      jitter: true,
    });

    expect(trajectory.length).toBeGreaterThanOrEqual(25);
    // Starting point check
    expect(trajectory[0].x).toBeCloseTo(start.x, 0);
    expect(trajectory[0].y).toBeCloseTo(start.y, 0);
    // Ending point check must reach target exactly
    const last = trajectory[trajectory.length - 1];
    expect(last.x).toBe(target.x);
    expect(last.y).toBe(target.y);

    // Intermediate points should not be a straight line (non-linear Bézier arc)
    const midPoint = trajectory[Math.floor(trajectory.length / 2)];
    const linearMidX = (start.x + target.x) / 2;
    const linearMidY = (start.y + target.y) / 2;
    // Difference should be non-zero due to curvature or jitter
    const hasCurvature = Math.hypot(midPoint.x - linearMidX, midPoint.y - linearMidY) > 0;
    expect(hasCurvature).toBe(true);
  });

  it("generates realistic Gaussian-distributed typing delays", () => {
    const text = "Hello, Krypton!";
    const delays = KeystrokeHumanizer.generateDelays(text);

    expect(delays).toHaveLength(text.length);
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(60);
      expect(delay).toBeLessThanOrEqual(350);
    }

    // Comma punctuation delay should be longer than standard lowercase letters
    const commaIndex = text.indexOf(",");
    const letterIndex = text.indexOf("e");
    expect(delays[commaIndex]).toBeGreaterThan(delays[letterIndex]);
  });
});
