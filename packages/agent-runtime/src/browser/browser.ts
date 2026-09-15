import * as fs from "node:fs";
import * as path from "node:path";
import {
  BrowserContextInfo,
  BrowserPoolStats,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

export interface BrowserPoolOptions {
  maxContexts?: number;
  idleTimeoutMs?: number;
  customRoot?: string;
  autoCheckIntervalMs?: number;
}

export interface BrowserContextHandle {
  id: string;
  info: BrowserContextInfo;
  viewport: { width: number; height: number };
  sessionStatePath: string;
  isClosed: boolean;
  close: () => Promise<void>;
}

/**
 * Manages browser context lifecycle, enforcing strict 2-context limit,
 * idle context recycling (>15m), persistent profile storage, and anti-bot stealth evasions.
 */
export class BrowserContextPool {
  public readonly maxContexts: number;
  public readonly idleTimeoutMs: number;
  private readonly profileDir: string;
  private readonly contexts = new Map<string, BrowserContextHandle>();
  private recycledCount = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: BrowserPoolOptions = {}) {
    this.maxContexts = options.maxContexts ?? 2;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 15 * 60 * 1000; // 15 minutes

    const kryptonHome = resolveKryptonHome(options.customRoot);
    this.profileDir = path.join(kryptonHome, "browser_profiles", "default");
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }

    // Optional background interval to periodically sweep idle contexts
    const checkInterval = options.autoCheckIntervalMs ?? 60_000;
    if (checkInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.recycleIdleContexts();
      }, checkInterval);
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Acquires or launches a new browser context.
   * If pool is at capacity (>= maxContexts), automatically recycles the oldest or idle context.
   */
  public async acquireContext(options: {
    contextId?: string;
    userAgent?: string;
    customViewport?: { width: number; height: number };
  } = {}): Promise<BrowserContextHandle> {
    // 1. Recycle any currently idle contexts first
    await this.recycleIdleContexts();

    // 2. If still at max capacity, evict the least recently accessed context
    if (this.contexts.size >= this.maxContexts) {
      const oldest = this.getLeastRecentlyUsedContext();
      if (oldest) {
        await this.recycle(oldest.id);
      }
    }

    const contextId = options.contextId || `ctx_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const viewport = options.customViewport || BrowserContextPool.getRandomDesktopViewport();
    const userAgent =
      options.userAgent ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

    const sessionStatePath = path.join(this.profileDir, `${contextId}_state.json`);

    let isClosed = false;
    const handle: BrowserContextHandle = {
      id: contextId,
      info: {
        contextId,
        createdAt: now,
        lastAccessedAt: now,
        isIdle: false,
        pageCount: 1,
        userAgent,
      },
      viewport,
      sessionStatePath,
      get isClosed() {
        return isClosed;
      },
      close: async () => {
        if (!isClosed) {
          isClosed = true;
          await this.recycle(contextId);
        }
      },
    };

    this.contexts.set(contextId, handle);
    return handle;
  }

  /**
   * Touches context to reset its idle expiration timer.
   */
  public touch(contextId: string): void {
    const handle = this.contexts.get(contextId);
    if (handle) {
      handle.info.lastAccessedAt = Date.now();
      handle.info.isIdle = false;
    }
  }

  /**
   * Recycles and frees a specific browser context, saving session state to disk.
   */
  public async recycle(contextId: string): Promise<boolean> {
    const handle = this.contexts.get(contextId);
    if (!handle) return false;

    // Persist cookies/storage mockup state to profile directory
    try {
      const statePayload = {
        contextId,
        recycledAt: Date.now(),
        cookies: [{ name: "session_id", value: `krypton_${contextId}`, domain: ".local" }],
        localStorage: { last_active: String(Date.now()) },
      };
      fs.writeFileSync(handle.sessionStatePath, JSON.stringify(statePayload, null, 2), "utf-8");
    } catch {
      // Ignored if disk unavailable
    }

    this.contexts.delete(contextId);
    this.recycledCount++;
    return true;
  }

  /**
   * Sweeps all contexts idle for > idleTimeoutMs and recycles them.
   */
  public async recycleIdleContexts(): Promise<number> {
    const now = Date.now();
    const idleIds: string[] = [];

    for (const [id, handle] of this.contexts.entries()) {
      if (now - handle.info.lastAccessedAt >= this.idleTimeoutMs) {
        idleIds.push(id);
      }
    }

    for (const id of idleIds) {
      await this.recycle(id);
    }

    return idleIds.length;
  }

  /**
   * Returns current pool health metrics.
   */
  public getStats(): BrowserPoolStats {
    const now = Date.now();
    let idleCount = 0;

    for (const handle of this.contexts.values()) {
      if (now - handle.info.lastAccessedAt >= this.idleTimeoutMs) {
        idleCount++;
      }
    }

    return {
      activeContextCount: this.contexts.size,
      maxContexts: this.maxContexts,
      idleContextCount: idleCount,
      recycledCount: this.recycledCount,
    };
  }

  /**
   * Returns the least-recently used context in the pool.
   */
  private getLeastRecentlyUsedContext(): BrowserContextHandle | null {
    let oldest: BrowserContextHandle | null = null;
    for (const handle of this.contexts.values()) {
      if (!oldest || handle.info.lastAccessedAt < oldest.info.lastAccessedAt) {
        oldest = handle;
      }
    }
    return oldest;
  }

  /**
   * Randomizes desktop viewport dimensions within realistic desktop display ranges
   * (e.g. 1366x768, 1440x900, 1536x864, 1920x1080).
   */
  public static getRandomDesktopViewport(): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1680, height: 1050 },
    ];
    const index = Math.floor(Math.random() * viewports.length);
    return viewports[index];
  }

  /**
   * Returns the anti-bot stealth evasion scripts for CDP injection:
   * 1. Overriding navigator.webdriver
   * 2. Spoofing WebGL vendor & renderer
   * 3. Spoofing AudioContext fingerprint
   * 4. Spoofing navigator.plugins and chrome runtime
   */
  public static getStealthScripts(): string {
    return `
      (() => {
        // 1. Override navigator.webdriver
        try {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          delete (Object.getPrototypeOf(navigator) as any).webdriver;
        } catch {}

        // 2. Mock Chrome runtime object
        if (!window.chrome) {
          (window as any).chrome = {
            runtime: {},
            app: {},
            csi: () => {},
            loadTimes: () => {},
          };
        }

        // 3. Spoof WebGL vendor and renderer strings
        try {
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) return 'Intel Inc.';
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) return 'Intel(R) Iris(TM) Xe Graphics';
            return getParameter.apply(this, arguments as any);
          };
        } catch {}

        // 4. Spoof navigator.plugins
        try {
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            ],
          });
        } catch {}

        // 5. AudioContext noise injection against fingerprinting
        try {
          const origGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function(channel) {
            const data = origGetChannelData.apply(this, arguments as any);
            for (let i = 0; i < data.length; i += 100) {
              data[i] += 0.0000001 * (Math.random() - 0.5);
            }
            return data;
          };
        } catch {}
      })();
    `;
  }

  /**
   * Cleans up all resources and background timers.
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const ids = Array.from(this.contexts.keys());
    for (const id of ids) {
      await this.recycle(id);
    }
  }
}
