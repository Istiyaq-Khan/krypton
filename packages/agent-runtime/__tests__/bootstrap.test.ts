import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  bootstrapKryptonHome,
  bootstrapAgentWorkspace,
  loadAgentArchetype,
  extractMarkdownSections,
  ARCHETYPE_FILE_NAMES,
} from "../src/index.js";

describe("Dynamic Agent Templating & Bootstrap System", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-bootstrap-test-"));
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("provisions base runtime directories without hardcoding agent names", async () => {
    const result = await bootstrapKryptonHome({ customRoot: tempRoot });

    expect(result.kryptonHome).toBe(tempRoot);
    expect(fs.existsSync(path.join(tempRoot, "config.json"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "credentials.enc"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "cache", "outputs"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "pty_sessions"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "telemetry"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "worktrees"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "tools", "python"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "tools", "typescript"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "browser_profiles", "default"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "logs"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "sandbox_workspace"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "agents"))).toBe(true);

    // No hardcoded agent workspace directories should exist
    expect(result.defaultAgent).toBeUndefined();
    const agentEntries = fs.readdirSync(path.join(tempRoot, "agents"));
    const agentDirs = agentEntries.filter((f) =>
      fs.statSync(path.join(tempRoot, "agents", f)).isDirectory()
    );
    expect(agentDirs).toHaveLength(0);

    // Default file-driven markdown templates should be seeded
    expect(fs.existsSync(path.join(tempRoot, "system.md"))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, "agents", "root.md"))).toBe(true);
  });

  it("dynamically provisions an agent workspace under any user-defined name as pure markdown prompts", async () => {
    const agentName = "code-architect-99";
    const result = await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot });

    expect(result.agentName).toBe(agentName);
    const agentDir = path.join(tempRoot, "agents", agentName);
    expect(fs.existsSync(agentDir)).toBe(true);
    expect(fs.existsSync(path.join(agentDir, "config.json"))).toBe(true);
    expect(fs.existsSync(path.join(agentDir, "short_term", "trajectories"))).toBe(true);

    // Assert all 7 archetype files are created
    for (const fileName of ARCHETYPE_FILE_NAMES) {
      const filePath = path.join(agentDir, fileName);
      expect(fs.existsSync(filePath), `Expected ${fileName} to exist`).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8");
      // Assert frontmatter summary exists
      expect(content.startsWith("---\n")).toBe(true);
      expect(content).toContain("summary:");
      expect(content).toContain("title:");
      expect(content).toContain("read_when:");
    }

    // Verify BOOTSTRAP.md has birth sequence and 5 beats
    const bootstrapContent = fs.readFileSync(path.join(agentDir, "BOOTSTRAP.md"), "utf-8");
    expect(bootstrapContent).toContain("BOOTSTRAP.md - Birth Sequence");
    expect(bootstrapContent).toContain("Ask What to Call You");
    expect(bootstrapContent).toContain("Choose Your Vibe");
    expect(bootstrapContent).toContain("Choose Your Avatar");
    expect(bootstrapContent).toContain("Finish With Recommendations");
    expect(bootstrapContent).toContain("One Safety Note");
    const sections = extractMarkdownSections(bootstrapContent);
    expect(sections["1. Ask What to Call You"]).toBeDefined();

    // Verify TODO.md has dual active/historical structure
    const todoContent = fs.readFileSync(path.join(agentDir, "TODO.md"), "utf-8");
    expect(todoContent).toContain("## Active Task DAG");
    expect(todoContent).toContain("## Historical Task Log");
  });

  it("preserves task history in TODO.md across subsequent bootstrap passes", async () => {
    const agentName = "audit-bot";
    await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot });

    const todoPath = path.join(tempRoot, "agents", agentName, "TODO.md");
    let todoContent = fs.readFileSync(todoPath, "utf-8");

    // Simulate appending completed tasks to the historical log
    const taskEntry = "\n- [x] Task 101: Audited auth.ts for vulnerabilities (2026-09-15)";
    fs.appendFileSync(todoPath, taskEntry, "utf-8");

    // Re-run bootstrap without forceReset
    await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot });

    // Ensure historical log is retained and NOT wiped clean
    todoContent = fs.readFileSync(todoPath, "utf-8");
    expect(todoContent).toContain("Task 101: Audited auth.ts for vulnerabilities");
  });

  it("loads archetype templates through loadAgentArchetype with lightweight frontmatter and directives", async () => {
    const agentName = "scraper-bot";
    const templates = await loadAgentArchetype(agentName, { CREATED_AT: "2026-09-15T12:00:00Z" });

    expect(templates["BOOTSTRAP.md"]).toContain("BOOTSTRAP.md - Birth Sequence");
    expect(templates["BOOTSTRAP.md"].startsWith("---\n")).toBe(true);
    expect(templates["SOUL.md"]).toContain("SOUL.md - Who You Are");
    expect(templates["SOUL.md"]).toContain("Core Truths");
    expect(templates["IDENTITY.md"]).toContain("IDENTITY.md - Who Am I?");
    expect(templates["IDENTITY.md"]).toContain("**Creature:**");
    expect(templates["AGENTS.md"]).toContain("AGENTS.md - Your Workspace");
    expect(templates["AGENTS.md"]).toContain("Existing Solutions Preflight");
    expect(templates["USER.md"]).toContain("USER.md - User Model");
    expect(templates["MEMORY.md"]).toContain("MEMORY.md - Durable Facts and Decisions");
    expect(templates["TODO.md"]).toContain("TODO.md - Task Ledger");
  });
});
