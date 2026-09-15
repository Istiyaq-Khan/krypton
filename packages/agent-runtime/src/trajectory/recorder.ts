import * as fs from "node:fs";
import * as path from "node:path";
import {
  DiffSummary,
  TrajectoryAction,
  TrajectoryActionSchema,
  TrajectoryObservation,
  TrajectoryObservationSchema,
  TrajectorySession,
  TrajectorySessionSchema,
  TrajectoryStep,
  TrajectoryStepSchema,
  TrajectoryVerificationDetails,
  VerificationStatus,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

export interface StartSessionOptions {
  sessionId?: string;
  agentId: string;
  taskId: string;
}

export interface RecordStepOptions {
  stepIndex: number;
  action: TrajectoryAction;
  observation: TrajectoryObservation;
  diffSummary?: DiffSummary;
  verificationStatus?: VerificationStatus;
  verificationDetails?: TrajectoryVerificationDetails;
}

/**
 * Prime-Agent Trajectory Recorder.
 * Records step-by-step frames (action, observation, tool calls, AST/file diffs, verification state)
 * into immutable audit logs under ~/.krypton/agents/<agent_name>/short_term/trajectories/<session-id>.json.
 */
export class TrajectoryRecorder {
  public readonly agentName: string;
  private readonly customRoot?: string;
  private currentSession: TrajectorySession | null = null;
  private trajectoryFilePath: string | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(agentName: string, customRoot?: string) {
    this.agentName = agentName;
    this.customRoot = customRoot;
  }

  public getSession(): TrajectorySession | null {
    return this.currentSession;
  }

  public getFilePath(): string | null {
    return this.trajectoryFilePath;
  }

  /**
   * Initializes a new trajectory audit session.
   */
  public startSession(options: StartSessionOptions): TrajectorySession {
    const home = resolveKryptonHome(this.customRoot);
    const trajectoriesDir = path.join(
      home,
      "agents",
      this.agentName,
      "short_term",
      "trajectories"
    );

    if (!fs.existsSync(trajectoriesDir)) {
      fs.mkdirSync(trajectoriesDir, { recursive: true });
    }

    const sessionId = options.sessionId ?? crypto.randomUUID();
    this.trajectoryFilePath = path.join(trajectoriesDir, `${sessionId}.json`);

    this.currentSession = TrajectorySessionSchema.parse({
      sessionId,
      agentId: options.agentId,
      taskId: options.taskId,
      steps: [],
      startedAt: Date.now(),
    });

    this.flush();
    return this.currentSession;
  }

  /**
   * Records a single trajectory step frame atomically to disk.
   */
  public async recordStep(options: RecordStepOptions): Promise<TrajectoryStep> {
    if (!this.currentSession) {
      throw new Error("Cannot record step: no active trajectory session started");
    }

    const validatedAction = TrajectoryActionSchema.parse(options.action);
    const validatedObservation = TrajectoryObservationSchema.parse(
      options.observation
    );

    const step: TrajectoryStep = TrajectoryStepSchema.parse({
      stepId: crypto.randomUUID(),
      agentId: this.currentSession.agentId,
      taskId: this.currentSession.taskId,
      stepIndex: options.stepIndex,
      action: validatedAction,
      observation: validatedObservation,
      diffSummary: options.diffSummary,
      verificationStatus: options.verificationStatus ?? "unverified",
      verificationDetails: options.verificationDetails,
      timestamp: Date.now(),
    });

    this.currentSession.steps.push(step);
    await this.flush();

    return step;
  }

  /**
   * Closes the session with a terminal status.
   */
  public async endSession(
    finalStatus: "completed" | "failed" | "aborted"
  ): Promise<TrajectorySession> {
    if (!this.currentSession) {
      throw new Error("No active trajectory session to end");
    }

    this.currentSession.completedAt = Date.now();
    this.currentSession.finalStatus = finalStatus;
    await this.flush();

    return this.currentSession;
  }

  private async flush(): Promise<void> {
    if (!this.currentSession || !this.trajectoryFilePath) return;

    const data = JSON.stringify(this.currentSession, null, 2);
    const filePath = this.trajectoryFilePath;

    this.writeQueue = this.writeQueue.then(async () => {
      await fs.promises.writeFile(filePath, data, "utf-8");
    });
    await this.writeQueue;
  }

  /**
   * Reads and parses a persisted trajectory session file.
   */
  public static async readSession(filePath: string): Promise<TrajectorySession> {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    return TrajectorySessionSchema.parse(JSON.parse(raw));
  }
}
