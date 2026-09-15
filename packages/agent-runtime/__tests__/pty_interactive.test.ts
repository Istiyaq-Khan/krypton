import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { PtyTerminalPool } from "../src/terminal/pty-pool.js";
import { cleanTerminalOutput, stripAnsi } from "../src/terminal/ansi-cleaner.js";

describe("Phase 4 Verification Gate: Persistent Interactive PTY Terminal Pool", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = path.join(os.tmpdir(), `krypton-test-pty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempRoot)) {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      } catch {}
    }
  });

  it("cleans complex ANSI/VT100 sequences, OSC sequences, and handles backspaces and line endings", () => {
    // 1. Color codes and bold
    const coloredText = "\x1b[32m\x1b[1m[SUCCESS]\x1b[0m Operation completed.";
    expect(stripAnsi(coloredText)).toBe("[SUCCESS] Operation completed.");

    // 2. Cursor movements and line erasing (\x1b[2K, \x1b[1G)
    const cursorText = "Downloading... \x1b[2K\x1b[1GDownload finished!\n";
    expect(stripAnsi(cursorText)).toBe("Downloading... Download finished!\n");

    // 3. OSC sequences (window title setting)
    const oscText = "\x1b]0;My Terminal Window\x07Hello world!";
    expect(stripAnsi(oscText)).toBe("Hello world!");

    // 4. Backspace character resolution
    const backspaceText = "abcde\b\bfg";
    expect(cleanTerminalOutput(backspaceText)).toBe("abcfg");

    // 5. Mixed CRLF normalization
    const crlfText = "line 1\r\nline 2\rline 3\n";
    expect(cleanTerminalOutput(crlfText)).toBe("line 1\nline 2\nline 3\n");
  });

  it("spawns interactive session, writes interactive stdin, persists output to log file, and terminates process tree", async () => {
    const pool = new PtyTerminalPool({ customRoot: tempRoot });

    // Use node process in interactive eval mode as cross-platform interactive target
    const cmd = process.execPath; // node.exe
    const args = ["-i"];

    const session = await pool.createSession({
      command: cmd,
      args,
      cols: 80,
      rows: 24,
    });

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe("running");
    expect(session.pid).toBeDefined();
    expect(fs.existsSync(session.logPath)).toBe(true);

    // Collect emitted chunks
    const receivedCleaned: string[] = [];
    pool.on("data", (evt) => {
      if (evt.sessionId === session.sessionId) {
        receivedCleaned.push(evt.cleaned);
      }
    });

    // Wait for node prompt to initialize
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Send interactive command via stdin
    await pool.writeStdin(session.sessionId, "console.log('KRYPTON_PTY_OK_' + (20 + 22));\n");

    // Wait for stdout processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Read output from memory and from persistent log file on disk
    const logContent = fs.readFileSync(session.logPath, "utf-8");
    const cleanedOutput = pool.getOutput(session.sessionId, { cleanAnsi: true });

    expect(cleanedOutput).toContain("KRYPTON_PTY_OK_42");
    expect(logContent).toContain("KRYPTON_PTY_OK_42");

    // Verify session listing
    const sessions = pool.listSessions();
    expect(sessions.some((s) => s.sessionId === session.sessionId)).toBe(true);

    // Clean process termination
    const killed = await pool.killSession(session.sessionId);
    expect(killed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 200));
    const finalSession = pool.getSession(session.sessionId);
    expect(finalSession?.status).toBe("terminated");

    await pool.shutdown();
  });
});
