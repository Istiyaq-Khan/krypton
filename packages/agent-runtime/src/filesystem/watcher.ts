import * as fs from "node:fs";
import * as path from "node:path";

export interface ConfigChangeEvent {
  filePath: string;
  agentName?: string;
  fileName: string;
  eventType: "change" | "rename";
  timestamp: number;
}

export type ConfigChangeCallback = (event: ConfigChangeEvent) => void;

/**
 * High-efficiency file watcher with debounced event dispatching for Krypton agent workspaces.
 */
export class KryptonFileWatcher {
  private watcher: fs.FSWatcher | null = null;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private listeners: ConfigChangeCallback[] = [];
  private readonly debounceMs: number;

  constructor(private readonly watchPath: string, debounceMs = 200) {
    this.debounceMs = debounceMs;
  }

  /**
   * Starts watching the target directory.
   */
  public start(): void {
    if (this.watcher) return;
    if (!fs.existsSync(this.watchPath)) return;

    try {
      this.watcher = fs.watch(
        this.watchPath,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;
          this.handleRawEvent(eventType as "change" | "rename", filename);
        }
      );
    } catch {
      // Fallback non-recursive if recursive watch fails
      this.watcher = fs.watch(this.watchPath, (eventType, filename) => {
        if (!filename) return;
        this.handleRawEvent(eventType as "change" | "rename", filename);
      });
    }
  }

  private handleRawEvent(eventType: "change" | "rename", relPath: string): void {
    const normPath = relPath.replace(/\\/g, "/");
    const fullPath = path.join(this.watchPath, relPath);
    const fileName = path.basename(normPath);

    // Only monitor markdown configs and json files
    const relevantExtensions = [".md", ".json"];
    if (!relevantExtensions.some((ext) => fileName.endsWith(ext))) {
      return;
    }

    // Extract agent name if within agents/<agentName>/...
    let agentName: string | undefined;
    const parts = normPath.split("/");
    const agentIndex = parts.indexOf("agents");
    if (agentIndex !== -1 && parts.length > agentIndex + 1) {
      agentName = parts[agentIndex + 1];
    }

    // Debounce duplicate events
    const timerKey = `${normPath}:${eventType}`;
    if (this.debounceTimers.has(timerKey)) {
      clearTimeout(this.debounceTimers.get(timerKey)!);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(timerKey);
      const event: ConfigChangeEvent = {
        filePath: fullPath,
        fileName,
        agentName,
        eventType,
        timestamp: Date.now(),
      };
      this.emit(event);
    }, this.debounceMs);

    this.debounceTimers.set(timerKey, timer);
  }

  public onChange(callback: ConfigChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private emit(event: ConfigChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in KryptonFileWatcher listener:", err);
      }
    }
  }

  public close(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.listeners = [];

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
