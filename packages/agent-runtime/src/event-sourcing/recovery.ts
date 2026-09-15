import * as fs from "node:fs";
import * as path from "node:path";
import { AgentState, AgentStateSchema } from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";
import { AgentEventStore } from "./event-store.js";

export interface RecoveredAgentSession {
  agentName: string;
  agentId?: string;
  lastState: AgentState;
  hasIncompleteTask: boolean;
  lastActiveTaskId?: string;
  lastSequenceNumber: number;
  activeWorktreePath?: string;
}

/**
 * State Recovery Manager rehydrating agent states and detecting crashed tasks on startup.
 */
export class StateRecoveryManager {
  private readonly kryptonHome: string;

  constructor(customRoot?: string) {
    this.kryptonHome = resolveKryptonHome(customRoot);
  }

  /**
   * Scans all agent directories and checks for incomplete tasks or interrupted runs.
   */
  public async scanAndRecover(): Promise<RecoveredAgentSession[]> {
    const agentsDir = path.join(this.kryptonHome, "agents");
    if (!fs.existsSync(agentsDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(agentsDir, { withFileTypes: true });
    const recovered: RecoveredAgentSession[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentName = entry.name;
      const session = await this.recoverAgent(agentName);
      if (session) {
        recovered.push(session);
      }
    }

    return recovered;
  }

  /**
   * Recovers state for a single agent from its events.jsonl file.
   */
  public async recoverAgent(agentName: string): Promise<RecoveredAgentSession | null> {
    const eventStore = new AgentEventStore(agentName, this.kryptonHome);
    const events = await eventStore.readEvents();

    if (events.length === 0) {
      return null;
    }

    let agentId: string | undefined;
    let lastState: AgentState = "idle";
    let lastActiveTaskId: string | undefined;
    let hasIncompleteTask = false;
    let activeWorktreePath: string | undefined;

    for (const event of events) {
      agentId = event.agentId;

      switch (event.eventType) {
        case "AgentSpawned":
          lastState = "idle";
          break;

        case "AgentStateChanged":
          if (typeof event.payload.state === "string") {
            const parsed = AgentStateSchema.safeParse(event.payload.state);
            if (parsed.success) {
              lastState = parsed.data;
            }
          }
          break;

        case "ToolExecuting":
          if (typeof event.payload.taskId === "string") {
            lastActiveTaskId = event.payload.taskId;
            hasIncompleteTask = true;
          }
          if (typeof event.payload.worktreePath === "string") {
            activeWorktreePath = event.payload.worktreePath;
          }
          lastState = "executing";
          break;

        case "ToolFinished":
          // Task might still be ongoing until StateCheckpointed or completed
          break;

        case "StateCheckpointed":
          if (event.payload.isTerminal) {
            hasIncompleteTask = false;
            lastState = "completed";
          }
          break;

        case "CrashResumed":
          lastState = "idle";
          hasIncompleteTask = false;
          break;
      }
    }

    if (lastState === "executing" || lastState === "planning") {
      hasIncompleteTask = true;
    }

    return {
      agentName,
      agentId,
      lastState,
      hasIncompleteTask,
      lastActiveTaskId,
      lastSequenceNumber: eventStore.getLatestSequence(),
      activeWorktreePath,
    };
  }
}
