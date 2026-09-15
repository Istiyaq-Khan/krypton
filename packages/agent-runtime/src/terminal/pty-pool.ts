import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import {
  PtyOutputEvent,
  PtySessionConfig,
  PtySessionInfo,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";
import { killProcessTree } from "../sandbox/runner.js";
import { cleanTerminalOutput } from "./ansi-cleaner.js";

export interface PtyPoolOptions {
  customRoot?: string;
  defaultCols?: number;
  defaultRows?: number;
}

interface ActivePtySession {
  info: PtySessionInfo;
  process: child_process.ChildProcess;
  logStream: fs.WriteStream;
  rawBuffer: string;
}

/**
 * Manages long-running interactive terminal and process sessions.
 * Persists output streams to ~/.krypton/pty_sessions/<session-id>.log,
 * supports interactive stdin injection, and handles clean process-tree termination.
 */
export class PtyTerminalPool extends EventEmitter {
  private readonly sessionsRoot: string;
  private readonly sessions = new Map<string, ActivePtySession>();

  constructor(options: PtyPoolOptions = {}) {
    super();
    const kryptonHome = resolveKryptonHome(options.customRoot);
    this.sessionsRoot = path.join(kryptonHome, "pty_sessions");
    if (!fs.existsSync(this.sessionsRoot)) {
      fs.mkdirSync(this.sessionsRoot, { recursive: true });
    }
  }

  /**
   * Spawns a persistent terminal session and begins logging output.
   */
  public async createSession(config: PtySessionConfig): Promise<PtySessionInfo> {
    const sessionId = config.sessionId || crypto.randomUUID();
    const logPath = config.logPath || path.join(this.sessionsRoot, `${sessionId}.log`);

    // Ensure directory and file exist synchronously
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, "", "utf-8");
    }

    // Prepare log stream
    const logStream = fs.createWriteStream(logPath, { flags: "a", encoding: "utf-8" });

    const env = {
      ...process.env,
      ...config.env,
      TERM: "xterm-256color",
      COLUMNS: String(config.cols || 80),
      LINES: String(config.rows || 24),
    };

    const child = child_process.spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });

    const info: PtySessionInfo = {
      sessionId,
      pid: child.pid,
      command: `${config.command} ${config.args.join(" ")}`.trim(),
      status: "running",
      exitCode: null,
      startedAt: Date.now(),
      logPath,
    };

    const sessionRecord: ActivePtySession = {
      info,
      process: child,
      logStream,
      rawBuffer: "",
    };

    this.sessions.set(sessionId, sessionRecord);

    const handleChunk = (chunk: Buffer | string) => {
      const raw = chunk.toString();
      sessionRecord.rawBuffer += raw;
      logStream.write(raw);

      const cleaned = cleanTerminalOutput(raw);
      const event: PtyOutputEvent = {
        sessionId,
        raw,
        cleaned,
        timestamp: Date.now(),
      };

      this.emit("data", event);
    };

    child.stdout?.on("data", handleChunk);
    child.stderr?.on("data", handleChunk);

    child.on("error", (err) => {
      info.status = "failed";
      logStream.write(`\n[Krypton Process Error: ${err.message}]\n`);
      this.emit("error", { sessionId, error: err });
    });

    child.on("exit", (code) => {
      info.status = info.status === "terminated" ? "terminated" : "exited";
      info.exitCode = code;
      info.endedAt = Date.now();
      logStream.end();
      this.emit("exit", { sessionId, exitCode: code });
    });

    return { ...info };
  }

  /**
   * Injects interactive text / keystrokes into the running terminal stdin.
   */
  public async writeStdin(sessionId: string, data: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.info.status !== "running") {
      throw new Error(`Session ${sessionId} is not active`);
    }

    return new Promise<void>((resolve, reject) => {
      if (!session.process.stdin?.writable) {
        return reject(new Error(`Session ${sessionId} stdin is not writable`));
      }

      session.process.stdin.write(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Retrieves status metadata for an active or completed session.
   */
  public getSession(sessionId: string): PtySessionInfo | null {
    const session = this.sessions.get(sessionId);
    return session ? { ...session.info } : null;
  }

  /**
   * Lists all sessions tracked in the pool.
   */
  public listSessions(): PtySessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s.info }));
  }

  /**
   * Retrieves output content for a session, with optional ANSI stripping and line limits.
   */
  public getOutput(
    sessionId: string,
    options: { cleanAnsi?: boolean; maxLines?: number } = {}
  ): string {
    const session = this.sessions.get(sessionId);
    let raw = "";

    if (session) {
      raw = session.rawBuffer;
    } else {
      const logFile = path.join(this.sessionsRoot, `${sessionId}.log`);
      if (fs.existsSync(logFile)) {
        raw = fs.readFileSync(logFile, "utf-8");
      } else {
        return "";
      }
    }

    const output = options.cleanAnsi !== false ? cleanTerminalOutput(raw) : raw;

    if (options.maxLines && options.maxLines > 0) {
      const lines = output.split("\n");
      return lines.slice(-options.maxLines).join("\n");
    }

    return output;
  }

  /**
   * Terminates a running terminal session and its entire child process tree.
   */
  public async killSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.info.status === "running" && session.process.pid) {
      session.info.status = "terminated";
      killProcessTree(session.process.pid);
      session.info.endedAt = Date.now();
      session.logStream.end();
    }

    return true;
  }

  /**
   * Cleanly kills all managed session process trees upon shutdown.
   */
  public async shutdown(): Promise<void> {
    const activeSessionIds = Array.from(this.sessions.keys());
    for (const id of activeSessionIds) {
      await this.killSession(id);
    }
  }
}
