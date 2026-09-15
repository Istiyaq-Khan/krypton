import * as fs from "node:fs";
import * as path from "node:path";
import {
  KryptonSystemEvent,
  KryptonSystemEventSchema,
  KryptonSystemEventType,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

/**
 * Append-only event store for an agent, logging to ~/.krypton/agents/<name>/short_term/events.jsonl.
 */
export class AgentEventStore {
  private readonly eventsFilePath: string;
  private currentSequence = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(agentName: string, customRoot?: string) {
    const home = resolveKryptonHome(customRoot);
    const shortTermDir = path.join(home, "agents", agentName, "short_term");
    if (!fs.existsSync(shortTermDir)) {
      fs.mkdirSync(shortTermDir, { recursive: true });
    }

    this.eventsFilePath = path.join(shortTermDir, "events.jsonl");
    this.initializeSequence();
  }

  private initializeSequence(): void {
    if (!fs.existsSync(this.eventsFilePath)) {
      this.currentSequence = 0;
      return;
    }

    try {
      const content = fs.readFileSync(this.eventsFilePath, "utf-8").trim();
      if (!content) {
        this.currentSequence = 0;
        return;
      }

      const lines = content.split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        const parsed = JSON.parse(lastLine);
        this.currentSequence = parsed.sequenceNumber ?? lines.length;
      }
    } catch {
      this.currentSequence = 0;
    }
  }

  public getLatestSequence(): number {
    return this.currentSequence;
  }

  /**
   * Appends an event atomically to events.jsonl.
   */
  public async appendEvent(
    data: Omit<KryptonSystemEvent, "sequenceNumber" | "eventId" | "timestamp">
  ): Promise<KryptonSystemEvent> {
    const sequenceNumber = ++this.currentSequence;
    const event: KryptonSystemEvent = {
      sequenceNumber,
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      eventType: data.eventType,
      agentId: data.agentId,
      payload: data.payload,
    };

    // Validate with Zod schema
    const validated = KryptonSystemEventSchema.parse(event);
    const line = JSON.stringify(validated) + "\n";

    // Chain onto write queue for thread-safe serialized write
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.promises.appendFile(this.eventsFilePath, line, "utf-8");
    });
    await this.writeQueue;

    return validated;
  }

  /**
   * Reads all recorded events, optionally filtering by event type.
   */
  public async readEvents(options?: {
    eventType?: KryptonSystemEventType;
  }): Promise<KryptonSystemEvent[]> {
    await this.writeQueue;

    if (!fs.existsSync(this.eventsFilePath)) {
      return [];
    }

    const content = await fs.promises.readFile(this.eventsFilePath, "utf-8");
    const lines = content.trim().split("\n");
    const events: KryptonSystemEvent[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        const event = KryptonSystemEventSchema.parse(parsed);
        if (!options?.eventType || event.eventType === options.eventType) {
          events.push(event);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return events;
  }
}
