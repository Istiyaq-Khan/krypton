import * as fs from "node:fs";
import * as path from "node:path";
import {
  WorkspaceRecord,
  WorkspaceRecordSchema,
  SessionThreadRecord,
  SessionThreadRecordSchema,
  PersistedWorkstationState,
  PersistedWorkstationStateSchema,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "./bootstrap.js";

export interface WorkspaceStorageOptions {
  customRoot?: string;
}

export type WorkspaceStorageOptionsInput = WorkspaceStorageOptions | string;

export function normalizeWorkspaceStorageOptions(
  options?: WorkspaceStorageOptionsInput
): WorkspaceStorageOptions | undefined {
  if (typeof options === "string") {
    return { customRoot: options };
  }
  return options;
}

/**
 * Performs crash-resilient atomic write of JSON content using a temporary staging file.
 * Guarantees that readers never observe partially written or corrupted JSON files.
 */
export async function atomicWriteJson(
  targetFilePath: string,
  data: unknown
): Promise<void> {
  const dir = path.dirname(targetFilePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  const tempFilePath = `${targetFilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const serialized = JSON.stringify(data, null, 2);

  await fs.promises.writeFile(tempFilePath, serialized, "utf-8");
  await fs.promises.rename(tempFilePath, targetFilePath);
}

/**
 * Resolves the directory housing workspace definitions (~/.krypton/workspaces).
 */
export function resolveWorkspacesDir(options?: WorkspaceStorageOptionsInput): string {
  const opts = normalizeWorkspaceStorageOptions(options);
  const home = resolveKryptonHome(opts?.customRoot);
  const dir = path.join(home, "workspaces");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolves the directory housing chat session histories (~/.krypton/sessions).
 */
export function resolveSessionsDir(options?: WorkspaceStorageOptionsInput): string {
  const opts = normalizeWorkspaceStorageOptions(options);
  const home = resolveKryptonHome(opts?.customRoot);
  const dir = path.join(home, "sessions");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Saves a workspace definition record reliably to disk.
 */
export async function saveWorkspaceRecord(
  workspace: WorkspaceRecord,
  options?: WorkspaceStorageOptionsInput
): Promise<WorkspaceRecord> {
  const validated = WorkspaceRecordSchema.parse({
    ...workspace,
    updatedAt: Date.now(),
  });
  const dir = resolveWorkspacesDir(options);
  const filePath = path.join(dir, `${validated.id}.json`);
  await atomicWriteJson(filePath, validated);
  return validated;
}

/**
 * Loads a workspace definition record from disk.
 */
export async function loadWorkspaceRecord(
  workspaceId: string,
  options?: WorkspaceStorageOptionsInput
): Promise<WorkspaceRecord | null> {
  const dir = resolveWorkspacesDir(options);
  const filePath = path.join(dir, `${workspaceId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return WorkspaceRecordSchema.parse(parsed);
  } catch (err) {
    console.error(`Failed to load workspace record [${workspaceId}]:`, err);
    return null;
  }
}

/**
 * Lists all registered workspace records from disk.
 */
export async function listWorkspaceRecords(
  options?: WorkspaceStorageOptionsInput
): Promise<WorkspaceRecord[]> {
  const dir = resolveWorkspacesDir(options);
  if (!fs.existsSync(dir)) return [];

  const files = await fs.promises.readdir(dir);
  const records: WorkspaceRecord[] = [];

  for (const file of files) {
    if (file.endsWith(".json") && !file.startsWith("workstation_state")) {
      const filePath = path.join(dir, file);
      try {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const valid = WorkspaceRecordSchema.safeParse(parsed);
        if (valid.success) {
          records.push(valid.data);
        }
      } catch {
        // Skip corrupted file
      }
    }
  }

  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Deletes a workspace record from disk.
 */
export async function deleteWorkspaceRecord(
  workspaceId: string,
  options?: WorkspaceStorageOptionsInput
): Promise<boolean> {
  const dir = resolveWorkspacesDir(options);
  const filePath = path.join(dir, `${workspaceId}.json`);
  if (!fs.existsSync(filePath)) return false;

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a chat session thread record and message history to disk.
 */
export async function saveSessionThread(
  session: SessionThreadRecord,
  options?: WorkspaceStorageOptionsInput
): Promise<SessionThreadRecord> {
  const validated = SessionThreadRecordSchema.parse({
    ...session,
    updatedAt: Date.now(),
  });
  const dir = resolveSessionsDir(options);
  const filePath = path.join(dir, `${validated.id}.json`);
  await atomicWriteJson(filePath, validated);
  return validated;
}

/**
 * Loads a chat session thread record and message history from disk.
 */
export async function loadSessionThread(
  sessionId: string,
  options?: WorkspaceStorageOptionsInput
): Promise<SessionThreadRecord | null> {
  const dir = resolveSessionsDir(options);
  const filePath = path.join(dir, `${sessionId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return SessionThreadRecordSchema.parse(parsed);
  } catch (err) {
    console.error(`Failed to load session record [${sessionId}]:`, err);
    return null;
  }
}

/**
 * Lists stored session threads, optionally filtered by workspace ID.
 */
export async function listSessionThreads(
  workspaceIdOrOptions?: string | WorkspaceStorageOptionsInput,
  options?: WorkspaceStorageOptionsInput
): Promise<SessionThreadRecord[]> {
  let workspaceId: string | undefined;
  let effectiveOptions: WorkspaceStorageOptionsInput | undefined = options;

  if (workspaceIdOrOptions !== undefined) {
    if (typeof workspaceIdOrOptions === "object") {
      effectiveOptions = workspaceIdOrOptions;
    } else if (
      !options &&
      typeof workspaceIdOrOptions === "string" &&
      (workspaceIdOrOptions.includes("/") ||
        workspaceIdOrOptions.includes("\\") ||
        workspaceIdOrOptions.includes("krypton-") ||
        workspaceIdOrOptions.includes("Temp") ||
        workspaceIdOrOptions.includes("temp"))
    ) {
      effectiveOptions = workspaceIdOrOptions;
    } else {
      workspaceId = workspaceIdOrOptions;
    }
  }

  const dir = resolveSessionsDir(effectiveOptions);
  if (!fs.existsSync(dir)) return [];

  const files = await fs.promises.readdir(dir);
  const sessions: SessionThreadRecord[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      const filePath = path.join(dir, file);
      try {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const valid = SessionThreadRecordSchema.safeParse(parsed);
        if (valid.success) {
          if (!workspaceId || valid.data.workspaceId === workspaceId || valid.data.projectId === workspaceId) {
            sessions.push(valid.data);
          }
        }
      } catch {
        // Skip corrupted session
      }
    }
  }

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Deletes a session thread record from disk.
 */
export async function deleteSessionThread(
  sessionId: string,
  options?: WorkspaceStorageOptionsInput
): Promise<boolean> {
  const dir = resolveSessionsDir(options);
  const filePath = path.join(dir, `${sessionId}.json`);
  if (!fs.existsSync(filePath)) return false;

  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists complete unified workstation state to disk.
 */
export async function saveWorkstationStateToDisk(
  state: PersistedWorkstationState,
  options?: WorkspaceStorageOptionsInput
): Promise<PersistedWorkstationState> {
  const opts = normalizeWorkspaceStorageOptions(options);
  const home = resolveKryptonHome(opts?.customRoot);
  const validated = PersistedWorkstationStateSchema.parse({
    ...state,
    updatedAt: Date.now(),
  });
  const statePath = path.join(home, "workstation-state.json");
  await atomicWriteJson(statePath, validated);

  // Synchronize individual workspace and session records for direct indexability
  for (const ws of validated.workspaces || []) {
    await saveWorkspaceRecord(ws, options);
  }
  for (const sess of validated.sessions || []) {
    await saveSessionThread(sess, options);
  }

  return validated;
}

/**
 * Loads complete unified workstation state from disk with graceful fallbacks.
 */
export async function loadWorkstationStateFromDisk(
  options?: WorkspaceStorageOptionsInput
): Promise<PersistedWorkstationState | null> {
  const opts = normalizeWorkspaceStorageOptions(options);
  const home = resolveKryptonHome(opts?.customRoot);
  const candidatePaths = [
    path.join(home, "workstation-state.json"),
    path.join(home, "workstation_state.json"),
    path.join(home, "workspaces", "workstation_state.json"),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const valid = PersistedWorkstationStateSchema.safeParse(parsed);
        if (valid.success) {
          return valid.data;
        }
      } catch {
        // Try next candidate
      }
    }
  }

  // Reconstruct from discrete workspace and session files if unified state file is missing
  const workspaces = await listWorkspaceRecords(options);
  const sessions = await listSessionThreads(undefined, options);

  if (workspaces.length === 0 && sessions.length === 0) {
    return null;
  }

  return {
    version: 2,
    workspaces,
    activeWorkspaceId: workspaces[0]?.id || "",
    activeThreadId: sessions[0]?.id || workspaces[0]?.activeThreadId || "",
    sessions,
    updatedAt: Date.now(),
  };
}

/**
 * Unified Workspace and Session Persistence Engine.
 */
export class WorkspaceStorageEngine {
  private readonly options?: WorkspaceStorageOptions;

  constructor(options?: WorkspaceStorageOptionsInput) {
    this.options = normalizeWorkspaceStorageOptions(options);
  }

  public async saveWorkspace(ws: WorkspaceRecord): Promise<WorkspaceRecord> {
    return saveWorkspaceRecord(ws, this.options);
  }

  public async loadWorkspace(id: string): Promise<WorkspaceRecord | null> {
    return loadWorkspaceRecord(id, this.options);
  }

  public async listWorkspaces(): Promise<WorkspaceRecord[]> {
    return listWorkspaceRecords(this.options);
  }

  public async deleteWorkspace(id: string): Promise<boolean> {
    return deleteWorkspaceRecord(id, this.options);
  }

  public async saveSession(session: SessionThreadRecord): Promise<SessionThreadRecord> {
    return saveSessionThread(session, this.options);
  }

  public async loadSession(id: string): Promise<SessionThreadRecord | null> {
    return loadSessionThread(id, this.options);
  }

  public async listSessions(workspaceId?: string): Promise<SessionThreadRecord[]> {
    return listSessionThreads(workspaceId, this.options);
  }

  public async deleteSession(id: string): Promise<boolean> {
    return deleteSessionThread(id, this.options);
  }

  public async saveState(state: PersistedWorkstationState): Promise<PersistedWorkstationState> {
    return saveWorkstationStateToDisk(state, this.options);
  }

  public async saveWorkstationState(state: PersistedWorkstationState): Promise<PersistedWorkstationState> {
    return this.saveState(state);
  }

  public async loadState(): Promise<PersistedWorkstationState | null> {
    return loadWorkstationStateFromDisk(this.options);
  }

  public async loadWorkstationState(): Promise<PersistedWorkstationState | null> {
    return this.loadState();
  }
}
