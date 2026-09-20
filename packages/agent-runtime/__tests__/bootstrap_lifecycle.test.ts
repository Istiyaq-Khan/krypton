import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import {
  bootstrapKryptonHome,
  bootstrapAgentWorkspace,
  loadAgentContext,
  deleteBootstrapFile,
  Agent,
  KryptonDaemonServer,
  WorkspaceStorageEngine,
  saveWorkspaceRecord,
  loadWorkspaceRecord,
  listWorkspaceRecords,
  deleteWorkspaceRecord,
  saveSessionThread,
  loadSessionThread,
  listSessionThreads,
  deleteSessionThread,
  saveWorkstationStateToDisk,
  loadWorkstationStateFromDisk,
} from "../src/index.js"
import {
  WorkspaceRecord,
  SessionThreadRecord,
  PersistedWorkstationState,
} from "@krypton/shared-types"

describe("Workspace Persistence & Agent-Governed Bootstrap Lifecycle", () => {
  let tempRoot: string

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-lifecycle-test-"))
  })

  afterEach(() => {
    try {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true })
      }
    } catch {
      // Ignore cleanup error
    }
  })

  describe("Workspace & Session Filesystem Persistence", () => {
    it("provisions workspaces and sessions directories in krypton home", async () => {
      await bootstrapKryptonHome({ customRoot: tempRoot })

      expect(fs.existsSync(path.join(tempRoot, "workspaces"))).toBe(true)
      expect(fs.existsSync(path.join(tempRoot, "sessions"))).toBe(true)
    })

    it("reliably commits workspace records and survives simulated restarts", async () => {
      const engine1 = new WorkspaceStorageEngine(tempRoot)

      const wsRecord: WorkspaceRecord = {
        id: "ws-project-alpha",
        name: "Project Alpha",
        path: path.join(tempRoot, "projects", "alpha"),
        branch: "main",
        activeAgentId: "agent-coder-1",
        createdAt: Date.now() - 10000,
        lastAccessedAt: Date.now(),
        settings: {
          autoCommit: true,
          sandboxMode: "strict",
        },
      }

      await engine1.saveWorkspace(wsRecord)

      // Verify file exists on disk
      const filePath = path.join(tempRoot, "workspaces", "ws-project-alpha.json")
      expect(fs.existsSync(filePath)).toBe(true)

      // Simulate runtime restart with a new engine instance
      const engine2 = new WorkspaceStorageEngine(tempRoot)
      const loaded = await engine2.loadWorkspace("ws-project-alpha")

      expect(loaded).toBeDefined()
      expect(loaded?.id).toBe("ws-project-alpha")
      expect(loaded?.name).toBe("Project Alpha")
      expect(loaded?.branch).toBe("main")
      expect(loaded?.settings?.sandboxMode).toBe("strict")

      // List workspaces
      const allWorkspaces = await engine2.listWorkspaces()
      expect(allWorkspaces).toHaveLength(1)
      expect(allWorkspaces[0].name).toBe("Project Alpha")

      // Delete workspace
      const deleted = await engine2.deleteWorkspace("ws-project-alpha")
      expect(deleted).toBe(true)
      expect(fs.existsSync(filePath)).toBe(false)
      const afterDelete = await engine2.listWorkspaces()
      expect(afterDelete).toHaveLength(0)
    })

    it("reliably commits session threads with message history to disk", async () => {
      const engine = new WorkspaceStorageEngine(tempRoot)

      const sessionRecord: SessionThreadRecord = {
        id: "sess-1001",
        title: "Feature Implementation - Auth Flow",
        workspaceId: "ws-project-alpha",
        agentId: "agent-coder-1",
        model: "claude-3-7-sonnet",
        provider: "anthropic",
        createdAt: Date.now() - 5000,
        updatedAt: Date.now(),
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Please set up OAuth2 callback endpoint.",
            timestamp: Date.now() - 4000,
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "I have initialized the OAuth2 router and verified AST boundaries.",
            timestamp: Date.now() - 2000,
          },
        ],
      }

      await engine.saveSession(sessionRecord)

      // Check file on disk
      const sessionFile = path.join(tempRoot, "sessions", "sess-1001.json")
      expect(fs.existsSync(sessionFile)).toBe(true)

      // Reload via standalone functions using customRoot
      const loaded = await loadSessionThread("sess-1001", tempRoot)
      expect(loaded).toBeDefined()
      expect(loaded?.title).toBe("Feature Implementation - Auth Flow")
      expect(loaded?.messages).toHaveLength(2)
      expect(loaded?.messages[0].content).toContain("OAuth2 callback")

      // List sessions
      const sessions = await listSessionThreads(tempRoot)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe("sess-1001")

      // Delete session
      const deleted = await deleteSessionThread("sess-1001", tempRoot)
      expect(deleted).toBe(true)
      expect(fs.existsSync(sessionFile)).toBe(false)
    })

    it("persists global workstation UI state to disk", async () => {
      const engine = new WorkspaceStorageEngine(tempRoot)

      const state: PersistedWorkstationState = {
        activeWorkspaceId: "ws-project-alpha",
        activeSessionId: "sess-1001",
        activeAgentId: "agent-coder-1",
        sidebarOpen: true,
        activeTab: "agents",
        recentWorkspaceIds: ["ws-project-alpha", "ws-project-beta"],
        updatedAt: Date.now(),
      }

      await engine.saveWorkstationState(state)

      // Check state file on disk
      const stateFile = path.join(tempRoot, "workstation-state.json")
      expect(fs.existsSync(stateFile)).toBe(true)

      // Reload state from disk
      const loadedState = await engine.loadWorkstationState()
      expect(loadedState).toBeDefined()
      expect(loadedState?.activeWorkspaceId).toBe("ws-project-alpha")
      expect(loadedState?.activeSessionId).toBe("sess-1001")
      expect(loadedState?.recentWorkspaceIds).toContain("ws-project-beta")
    })
  })

  describe("Agent-Governed BOOTSTRAP.md Lifecycle", () => {
    it("provisions BOOTSTRAP.md on initial creation and never deletes it automatically across reboots", async () => {
      const agentName = "nova-agent"
      const result = await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })

      const agentDir = result.agentDir
      const bootstrapPath = path.join(agentDir, "BOOTSTRAP.md")
      expect(fs.existsSync(bootstrapPath)).toBe(true)

      // Simulate multiple daemon reboots / re-running bootstrap
      await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })
      await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })

      // Invariant: BOOTSTRAP.md MUST STILL EXIST (zero system-level deletion)
      expect(fs.existsSync(bootstrapPath)).toBe(true)
    })

    it("injects BOOTSTRAP.md into the agent prompt context with operational directives", async () => {
      const agentName = "genesis-bot"
      const result = await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })
      const agentDir = result.agentDir

      // Load agent context
      const context = await loadAgentContext(agentName, tempRoot)

      expect(context.bootstrapPrompt).toBeDefined()
      expect(context.bootstrapPrompt).toContain("BOOTSTRAP.md - Birth Sequence")
      expect(context.bootstrapDirectives).toBeDefined()
      expect(context.bootstrapDirectives).toContain("CRITICAL ONBOARDING DIRECTIVE")
      expect(context.bootstrapDirectives).toContain("Krypton will NEVER automatically delete this file")
      expect(context.bootstrapDirectives).toContain("You alone are responsible for removing this file")

      // Combined system prompt must contain the birth sequence and directives
      expect(context.combinedSystemPrompt).toContain("CRITICAL ONBOARDING DIRECTIVE")
      expect(context.combinedSystemPrompt).toContain("BOOTSTRAP.md - Birth Sequence")

      // Agent.fromWorkspace must also ingest the directives
      const agent = await Agent.fromWorkspace(agentDir)
      const systemPrompt = agent.getSystemPrompt()
      expect(systemPrompt).toContain("CRITICAL ONBOARDING DIRECTIVE")
      expect(systemPrompt).toContain("BOOTSTRAP.md - Birth Sequence")
    })

    it("supports lowercase bootstrap.md for cross-platform parity", async () => {
      const agentName = "lowercase-bot"
      const result = await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })
      const agentDir = result.agentDir

      // Remove uppercase BOOTSTRAP.md and seed lowercase bootstrap.md
      const upperPath = path.join(agentDir, "BOOTSTRAP.md")
      const lowerPath = path.join(agentDir, "bootstrap.md")
      if (fs.existsSync(upperPath)) {
        fs.unlinkSync(upperPath)
      }

      fs.writeFileSync(
        lowerPath,
        `# bootstrap.md - Lowercase Onboarding\n\nRun initialization scripts.\n`,
        "utf-8"
      )

      const context = await loadAgentContext(agentName, tempRoot)
      expect(context.bootstrapPrompt).toContain("Lowercase Onboarding")
      expect(context.bootstrapDirectives).toContain("CRITICAL ONBOARDING DIRECTIVE")
      expect(context.combinedSystemPrompt).toContain("Lowercase Onboarding")

      // Ensure deleteBootstrapFile resolves lowercase bootstrap.md
      const deleted = await deleteBootstrapFile(agentDir)
      expect(deleted).toBe(true)
      expect(fs.existsSync(lowerPath)).toBe(false)
    })

    it("allows the agent to delete BOOTSTRAP.md via tools and ensures it is never resurrected", async () => {
      const agentName = "lifecycle-bot"
      const result = await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })
      const agentDir = result.agentDir
      const bootstrapPath = path.join(agentDir, "BOOTSTRAP.md")

      expect(fs.existsSync(bootstrapPath)).toBe(true)

      // Boot agent instance
      const agent = await Agent.fromWorkspace(agentDir)
      expect(agent.getSystemPrompt()).toContain("CRITICAL ONBOARDING DIRECTIVE")

      // Agent executes tool call to delete BOOTSTRAP.md once onboarding tasks complete
      const toolResult = await agent.executeBuiltinTool("file_delete", {
        path: "BOOTSTRAP.md",
      })

      expect(toolResult.success).toBe(true)
      expect(toolResult.output).toContain("Successfully deleted BOOTSTRAP.md")
      expect(fs.existsSync(bootstrapPath)).toBe(false)

      // Re-load agent context: bootstrap directives must no longer be present
      const contextAfter = await loadAgentContext(agentName, tempRoot)
      expect(contextAfter.bootstrapPrompt).toBeUndefined()
      expect(contextAfter.bootstrapDirectives).toBeUndefined()
      expect(contextAfter.combinedSystemPrompt).not.toContain("CRITICAL ONBOARDING DIRECTIVE")

      // Simulate a restart and re-run bootstrap: BOOTSTRAP.md must NOT be recreated for an existing agent
      await bootstrapAgentWorkspace(agentName, { customRoot: tempRoot })
      expect(fs.existsSync(bootstrapPath)).toBe(false)
    })
  })

  describe("Daemon RPC Dispatcher Integration", () => {
    let daemon: KryptonDaemonServer

    beforeEach(async () => {
      daemon = new KryptonDaemonServer({
        port: 0, // don't listen on actual network port
      })
    })

    afterEach(async () => {
      try {
        await daemon.stop()
      } catch {
        // Ignore
      }
    })

    it("handles workspace, session, and bootstrap deletion RPC calls", async () => {
      // 1. Save workspace
      const saveWsRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 1,
        method: "workspace:save",
        params: {
          id: "ws-rpc-test",
          name: "RPC Test Project",
          path: path.join(tempRoot, "rpc-project"),
          branch: "main",
        },
      })
      expect(saveWsRes.result).toBeDefined()
      expect((saveWsRes.result as any).workspace?.name).toBe("RPC Test Project")

      // 2. Load workspace
      const loadWsRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 2,
        method: "workspace:load",
        params: { id: "ws-rpc-test" },
      })
      expect(loadWsRes.result).toBeDefined()
      expect((loadWsRes.result as any).workspace?.id).toBe("ws-rpc-test")

      // 3. List workspaces
      const listWsRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 3,
        method: "workspace:list",
      })
      expect(listWsRes.result).toBeDefined()
      expect((listWsRes.result as any).workspaces.length).toBeGreaterThanOrEqual(1)

      // 4. Save session
      const saveSessRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 4,
        method: "session:save",
        params: {
          id: "sess-rpc-1",
          title: "Daemon RPC Session",
          workspaceId: "ws-rpc-test",
          messages: [
            { id: "m1", role: "user", content: "Hello", timestamp: Date.now() },
          ],
        },
      })
      expect(saveSessRes.result).toBeDefined()
      expect((saveSessRes.result as any).session?.title).toBe("Daemon RPC Session")

      // 5. Load session
      const loadSessRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 5,
        method: "session:load",
        params: { id: "sess-rpc-1" },
      })
      expect(loadSessRes.result).toBeDefined()
      expect((loadSessRes.result as any).session?.messages).toHaveLength(1)

      // 6. Workstation state
      const saveStateRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 6,
        method: "workstation:saveState",
        params: {
          activeWorkspaceId: "ws-rpc-test",
          activeSessionId: "sess-rpc-1",
          sidebarOpen: false,
        },
      })
      expect(saveStateRes.result).toBeDefined()
      expect((saveStateRes.result as any).state?.activeWorkspaceId).toBe("ws-rpc-test")

      const loadStateRes = await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 7,
        method: "workstation:loadState",
      })
      expect(loadStateRes.result).toBeDefined()
      expect((loadStateRes.result as any).state?.activeWorkspaceId).toBe("ws-rpc-test")

      // 7. Cleanup session and workspace
      await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 8,
        method: "session:delete",
        params: { id: "sess-rpc-1" },
      })

      await daemon.handleRpcCall({
        jsonrpc: "2.0",
        id: 9,
        method: "workspace:delete",
        params: { id: "ws-rpc-test" },
      })
    })
  })
})
