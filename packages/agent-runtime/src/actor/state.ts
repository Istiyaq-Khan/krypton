import * as fs from "node:fs";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import {
  AgentState,
  AgentStateSchema,
} from "@krypton/shared-types";
import { AgentEventStore } from "../event-sourcing/event-store.js";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

/**
 * Valid lifecycle transitions for an Actor agent instance.
 */
const VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
  uninitialized: ["idle", "aborted", "failed"],
  idle: ["planning", "executing", "awaiting_input", "completed", "aborted"],
  planning: [
    "executing",
    "awaiting_input",
    "compacting",
    "completed",
    "failed",
    "aborted",
  ],
  executing: [
    "planning",
    "verifying",
    "awaiting_input",
    "compacting",
    "completed",
    "failed",
    "aborted",
  ],
  awaiting_input: ["executing", "planning", "failed", "aborted"],
  compacting: ["planning", "executing", "failed", "aborted"],
  verifying: ["completed", "failed", "executing", "planning", "aborted"],
  completed: ["idle", "planning", "executing"], // Can be reactivated for new tasks
  failed: ["idle", "planning", "executing", "aborted"], // Can retry after failure
  aborted: ["idle"], // Can be reset
};

export interface StateChangeEvent {
  agentId: string;
  previousState: AgentState;
  newState: AgentState;
  reason?: string;
  timestamp: number;
}

/**
 * Manages the lifecycle states of an Actor agent, enforces transition rules,
 * logs state changes to the append-only event store, and handles long-term MEMORY.md distillation.
 */
export class AgentStateManager extends EventEmitter {
  private currentState: AgentState;
  private readonly agentId: string;
  private readonly agentName: string;
  private readonly customRoot?: string;
  private readonly eventStore?: AgentEventStore;

  constructor(options: {
    agentId: string;
    agentName: string;
    initialState?: AgentState;
    customRoot?: string;
    eventStore?: AgentEventStore;
  }) {
    super();
    this.agentId = options.agentId;
    this.agentName = options.agentName;
    this.customRoot = options.customRoot;
    this.eventStore = options.eventStore;
    this.currentState = AgentStateSchema.parse(
      options.initialState ?? "uninitialized"
    );
  }

  public getState(): AgentState {
    return this.currentState;
  }

  public isTerminal(): boolean {
    return (
      this.currentState === "completed" ||
      this.currentState === "failed" ||
      this.currentState === "aborted"
    );
  }

  /**
   * Transitions the agent to a new state if the transition is permissible.
   */
  public async transitionTo(
    newState: AgentState,
    reason?: string
  ): Promise<AgentState> {
    const validatedNewState = AgentStateSchema.parse(newState);

    if (this.currentState === validatedNewState) {
      return this.currentState;
    }

    const allowed = VALID_TRANSITIONS[this.currentState];
    if (allowed && !allowed.includes(validatedNewState)) {
      throw new Error(
        `Invalid agent state transition: cannot transition from '${this.currentState}' to '${validatedNewState}' for agent '${this.agentName}'`
      );
    }

    const previousState = this.currentState;
    this.currentState = validatedNewState;

    const changeEvent: StateChangeEvent = {
      agentId: this.agentId,
      previousState,
      newState: validatedNewState,
      reason,
      timestamp: Date.now(),
    };

    // Emit in-memory event
    this.emit("stateChange", changeEvent);

    // Append to event store if available
    if (this.eventStore) {
      try {
        await this.eventStore.appendEvent({
          eventType: "AgentStateChanged",
          agentId: this.agentId,
          payload: {
            previousState,
            newState: validatedNewState,
            reason: reason ?? null,
          },
        });
      } catch (err) {
        // Non-blocking fallback for event logging
        this.emit("error", err);
      }
    }

    return this.currentState;
  }

  /**
   * Appends distilled insights and facts to ~/.krypton/agents/<agent_name>/MEMORY.md.
   */
  public async distillMemory(insights: string[]): Promise<void> {
    if (!insights || insights.length === 0) return;

    const home = resolveKryptonHome(this.customRoot);
    const agentDir = path.join(home, "agents", this.agentName);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    const memoryPath = path.join(agentDir, "MEMORY.md");
    const timestampStr = new Date().toISOString().split("T")[0];

    const newEntries = insights
      .map((entry) => `- [${timestampStr}] ${entry.trim()}`)
      .join("\n");

    if (fs.existsSync(memoryPath)) {
      const existing = await fs.promises.readFile(memoryPath, "utf-8");
      const updated = existing.trim() + "\n\n" + newEntries + "\n";
      await fs.promises.writeFile(memoryPath, updated, "utf-8");
    } else {
      const header = `# Distilled Long-Term Memory: ${this.agentName}\n\nAutonomous learnings, recurring patterns, and user preferences extracted across sessions.\n\n`;
      await fs.promises.writeFile(
        memoryPath,
        header + newEntries + "\n",
        "utf-8"
      );
    }

    this.emit("memoryDistilled", {
      agentName: this.agentName,
      entriesCount: insights.length,
    });
  }
}
