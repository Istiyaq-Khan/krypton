import { describe, it, expect } from "vitest";
import {
  // Agent
  RoleSchema,
  ToolCallSchema,
  ToolResultSchema,
  MessageSchema,
  AgentStateSchema,
  TokenBudgetSchema,
  RecursionBoundarySchema,
  AgentContextSchema,
  // Tasks
  TaskStatusSchema,
  TaskNodeSchema,
  TaskTreeSchema,
  PlanPatchSchema,
  PlanPatchBatchSchema,
  TaskMarkdownSyncSchema,
  // MCP
  McpToolSchema,
  StdioTransportConfigSchema,
  SseTransportConfigSchema,
  McpServerConfigSchema,
  ToolExecutionRequestSchema,
  ToolExecutionResultSchema,
  SynthesizedToolMetadataSchema,
  // VCS
  WorktreeContextSchema,
  SemanticCommitMetaSchema,
  FilePatchSchema,
  DiffSummarySchema,
  RollbackRequestSchema,
  MergeApprovalRequestSchema,
  // HITL
  InteractionChannelSchema,
  ChoiceOptionSchema,
  ClarificationRequestSchema,
  ClarificationResponseSchema,
  ClarificationCancelationSchema,
  // IPC
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcNotificationSchema,
  WebSocketPacketSchema,
  WINDOWS_NAMED_PIPE,
  POSIX_DOMAIN_SOCKET,
  // Events
  KryptonSystemEventSchema,
  TrajectoryStepSchema,
  TrajectorySessionSchema,
  // Config
  GlobalConfigSchema,
  AgentPermissionsManifestSchema,
  AgentSoulSpecSchema,
  AgentIdentitySpecSchema,
  AgentUserPreferencesSpecSchema,
  AgentMemorySpecSchema,
  AgentBootstrapSpecSchema,
  VaultCredentialSchema,
  // Phase 4: Perception & Interaction
  AXNodeSchema,
  AXTreeSnapshotSchema,
  BrowserActionRequestSchema,
  BrowserActionResultSchema,
  BrowserPoolStatsSchema,
  PtySessionConfigSchema,
  PtySessionInfoSchema,
  PtyOutputEventSchema,
  CodeSymbolSchema,
  ImportGraphEdgeSchema,
  RepositoryIndexSchema,
  LspDiagnosticSchema,
  LspLocationSchema,
  LspHoverInfoSchema,
  DesktopWindowInfoSchema,
  DesktopUINodeSchema,
} from "../src/index.js";

describe("Phase 1: Shared Core & Type Contracts Verification Suite", () => {
  describe("1. Universal Agent & Context Contracts", () => {
    it("validates valid Role, ToolCall, and Message", () => {
      expect(RoleSchema.parse("assistant")).toBe("assistant");
      expect(() => RoleSchema.parse("invalid_role")).toThrow();

      const toolCall = ToolCallSchema.parse({
        id: "call_123",
        name: "execute_python",
        arguments: { code: "print('hello')" },
      });
      expect(toolCall.name).toBe("execute_python");

      const toolResult = ToolResultSchema.parse({
        toolCallId: "call_123",
        toolName: "execute_python",
        content: "hello\n",
        isError: false,
      });
      expect(toolResult.isError).toBe(false);

      const message = MessageSchema.parse({
        role: "assistant",
        content: "I will execute the script.",
        toolCalls: [toolCall],
      });
      expect(message.toolCalls).toHaveLength(1);
    });

    it("enforces RecursionBoundary limits (maxDepth <= 3, maxConcurrentChildren <= 5)", () => {
      const validBoundary = RecursionBoundarySchema.parse({
        maxDepth: 3,
        maxConcurrentChildren: 5,
        timeoutMs: 60_000,
      });
      expect(validBoundary.maxDepth).toBe(3);

      // Depth > 3 must fail
      expect(() =>
        RecursionBoundarySchema.parse({
          maxDepth: 4,
          maxConcurrentChildren: 2,
        })
      ).toThrow();

      // Concurrency > 5 must fail
      expect(() =>
        RecursionBoundarySchema.parse({
          maxDepth: 2,
          maxConcurrentChildren: 6,
        })
      ).toThrow();
    });

    it("validates AgentContext structure and defaults", () => {
      const agentId = "11111111-1111-4111-a111-111111111111";
      const context = AgentContextSchema.parse({
        agentId,
        name: "OrchestratorAgent",
        tokenBudget: {
          hardLimit: 100_000,
        },
      });

      expect(context.name).toBe("OrchestratorAgent");
      expect(context.recursionDepth).toBe(0);
      expect(context.tokenBudget.usedTokens).toBe(0);
      expect(context.tokenBudget.warningThreshold).toBe(0.85);
      expect(context.state).toBe("idle");
    });
  });

  describe("2. Task DAG & Planner Contracts", () => {
    const taskId1 = "22222222-2222-4222-a222-222222222221";
    const taskId2 = "22222222-2222-4222-a222-222222222222";
    const agentId = "11111111-1111-4111-a111-111111111111";

    it("validates TaskNode and TaskTree container", () => {
      const task1 = TaskNodeSchema.parse({
        id: taskId1,
        title: "Clone repository",
        description: "Fetch source tree from git",
        assignedAgentId: agentId,
        status: "completed",
      });

      const task2 = TaskNodeSchema.parse({
        id: taskId2,
        title: "Compile project",
        description: "Run pnpm build",
        assignedAgentId: agentId,
        dependsOn: [taskId1],
        status: "pending",
      });

      const tree = TaskTreeSchema.parse({
        agentId,
        rootTaskIds: [taskId1],
        tasks: {
          [taskId1]: task1,
          [taskId2]: task2,
        },
      });

      expect(tree.tasks[taskId2]?.dependsOn).toContain(taskId1);
      expect(tree.version).toBe(1);
    });

    it("validates PlanPatch discriminated union variants", () => {
      const insertPatch = PlanPatchSchema.parse({
        op: "insertTask",
        task: {
          id: taskId1,
          title: "Fix lint issue",
          assignedAgentId: agentId,
        },
      });
      expect(insertPatch.op).toBe("insertTask");

      const markFailedPatch = PlanPatchSchema.parse({
        op: "markFailed",
        taskId: taskId1,
        reason: "Compilation error in auth.ts:24",
        suggestedRemediation: "Insert Task 2b to fix auth.ts",
      });
      expect(markFailedPatch.op).toBe("markFailed");

      const batch = PlanPatchBatchSchema.parse({
        agentId,
        treeId: "33333333-3333-4333-a333-333333333333",
        patches: [insertPatch, markFailedPatch],
      });
      expect(batch.patches).toHaveLength(2);
    });

    it("validates TaskMarkdownSync serialization schema", () => {
      const sync = TaskMarkdownSyncSchema.parse({
        agentId,
        agentName: "Orchestrator",
        markdownContent: "- [x] Task 1: Complete\n- [ ] Task 2: Pending",
        entries: [
          { title: "Task 1: Complete", completed: true, depth: 0, status: "completed" },
          { title: "Task 2: Pending", completed: false, depth: 0, status: "pending" },
        ],
      });
      expect(sync.entries).toHaveLength(2);
    });
  });

  describe("3. MCP & Tool Specification Contracts", () => {
    it("validates McpTool with JSON Schema input definition", () => {
      const tool = McpToolSchema.parse({
        name: "sqlite_query",
        description: "Execute read-only SQL query against local SQLite DB",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "The SQL statement" },
          },
          required: ["sql"],
        },
      });
      expect(tool.name).toBe("sqlite_query");
      expect(tool.inputSchema.required).toContain("sql");
    });

    it("validates Stdio and SSE transport configs", () => {
      const stdio = StdioTransportConfigSchema.parse({
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sqlite"],
        env: { DEBUG: "true" },
      });
      expect(stdio.type).toBe("stdio");

      const sse = SseTransportConfigSchema.parse({
        type: "sse",
        url: "https://mcp.krypton.local/sse",
      });
      expect(sse.type).toBe("sse");
      expect(sse.reconnectionOptions.maxRetries).toBe(5);

      const serverConfig = McpServerConfigSchema.parse({
        name: "sqlite_server",
        transport: stdio,
      });
      expect(serverConfig.enabled).toBe(true);
    });

    it("validates ToolExecutionRequest and SynthesizedToolMetadata", () => {
      const agentId = "11111111-1111-4111-a111-111111111111";
      const request = ToolExecutionRequestSchema.parse({
        agentId,
        toolName: "dynamic_scraper",
        parameters: { url: "https://example.com" },
      });
      expect(request.sandbox).toBe(true);

      const synth = SynthesizedToolMetadataSchema.parse({
        name: "ast_visitor",
        language: "typescript",
        sourceCode: "export function visit() {}",
        safetyLinterStatus: "passed",
        isReusable: true,
      });
      expect(synth.safetyLinterStatus).toBe("passed");
      expect(synth.isReusable).toBe(true);
    });
  });

  describe("4. Version Control & Worktree Contracts", () => {
    const taskId = "22222222-2222-4222-a222-222222222221";

    it("validates WorktreeContext and SemanticCommitMeta", () => {
      const worktree = WorktreeContextSchema.parse({
        taskId,
        targetRepoPath: "/home/user/my-project",
        worktreePath: "/home/user/.krypton/worktrees/task-1",
        baseCommitHash: "a1b2c3d4e5f67890",
        branchName: "krypton/task-1",
      });
      expect(worktree.branchName).toBe("krypton/task-1");
      expect(worktree.status).toBe("active");

      const commit = SemanticCommitMetaSchema.parse({
        type: "feat",
        scope: "auth",
        description: "implement jwt session validation",
        taskId,
        stepIndex: 1,
      });
      expect(commit.type).toBe("feat");
    });

    it("validates DiffSummary and MergeApprovalRequest", () => {
      const diff = DiffSummarySchema.parse({
        baseCommitHash: "1111111",
        targetCommitHash: "2222222",
        files: [
          {
            filePath: "src/auth.ts",
            status: "modified",
            additions: 15,
            deletions: 2,
            hasConflict: false,
          },
        ],
        totalAdditions: 15,
        totalDeletions: 2,
        totalModifiedFiles: 1,
      });
      expect(diff.totalAdditions).toBe(15);

      const approval = MergeApprovalRequestSchema.parse({
        taskId,
        featureBranch: "krypton/task-1",
        worktreePath: "/tmp/worktree",
        diffSummary: diff,
        commitMessages: ["feat(auth): add jwt support"],
      });
      expect(approval.status).toBe("pending");
    });
  });

  describe("5. HITL Interaction Contracts", () => {
    const agentId = "11111111-1111-4111-a111-111111111111";

    it("validates ClarificationRequest with options and keyboard hotkeys", () => {
      const request = ClarificationRequestSchema.parse({
        agentId,
        prompt: "Which database adapter should be initialized?",
        options: [
          { id: "opt_pg", label: "PostgreSQL", description: "Production DB", hotkey: "1", isRecommended: true },
          { id: "opt_sqlite", label: "SQLite", description: "Local embedded DB", hotkey: "2" },
        ],
      });
      expect(request.options).toHaveLength(2);
      expect(request.options[0]?.isRecommended).toBe(true);
    });

    it("validates ClarificationResponse across multiple supported channels", () => {
      const channels = [
        "desktop_ui",
        "cli",
        "voice_hud",
        "telegram",
        "discord",
        "whatsapp",
        "slack",
        "signal",
      ] as const;

      for (const channel of channels) {
        const response = ClarificationResponseSchema.parse({
          requestId: "44444444-4444-4444-a444-444444444444",
          selectedOptionIds: ["opt_pg"],
          respondingChannel: channel,
        });
        expect(response.respondingChannel).toBe(channel);
      }
    });

    it("validates ClarificationCancelation", () => {
      const cancel = ClarificationCancelationSchema.parse({
        requestId: "44444444-4444-4444-a444-444444444444",
        resolvedByChannel: "desktop_ui",
      });
      expect(cancel.resolvedByChannel).toBe("desktop_ui");
    });
  });

  describe("6. IPC, RPC & WebSocket Wire Protocols", () => {
    it("validates JSON-RPC 2.0 Request, Response, and Notification", () => {
      const req = JsonRpcRequestSchema.parse({
        jsonrpc: "2.0",
        id: 1,
        method: "agent.spawn",
        params: { role: "coder" },
      });
      expect(req.method).toBe("agent.spawn");

      const res = JsonRpcResponseSchema.parse({
        jsonrpc: "2.0",
        id: 1,
        result: { agentId: "11111111-1111-4111-a111-111111111111" },
      });
      expect(res.id).toBe(1);

      const notif = JsonRpcNotificationSchema.parse({
        jsonrpc: "2.0",
        method: "heartbeat",
      });
      expect(notif.method).toBe("heartbeat");
    });

    it("validates WebSocket streaming packets", () => {
      const agentId = "11111111-1111-4111-a111-111111111111";

      const tokenStream = WebSocketPacketSchema.parse({
        type: "token_stream",
        agentId,
        delta: "const x = 42;",
        isComplete: false,
        index: 0,
      });
      expect(tokenStream.type).toBe("token_stream");

      const steering = WebSocketPacketSchema.parse({
        type: "steering_input",
        instruction: "Stop and run unit tests first",
        source: "voice_hud",
      });
      expect(steering.type).toBe("steering_input");

      const voice = WebSocketPacketSchema.parse({
        type: "voice_transcribed",
        transcript: "Run all test cases",
        isFinal: true,
      });
      expect(voice.type).toBe("voice_transcribed");
    });

    it("exports standard platform pipe endpoints", () => {
      expect(WINDOWS_NAMED_PIPE).toBe("\\\\.\\pipe\\krypton-ipc");
      expect(POSIX_DOMAIN_SOCKET).toBe("/tmp/krypton.sock");
    });
  });

  describe("7. Event-Sourcing & Trajectory Contracts", () => {
    const agentId = "11111111-1111-4111-a111-111111111111";
    const taskId = "22222222-2222-4222-a222-222222222221";

    it("validates KryptonSystemEvent record", () => {
      const event = KryptonSystemEventSchema.parse({
        sequenceNumber: 42,
        eventType: "StateCheckpointed",
        agentId,
        payload: { tokenUtilization: 0.92 },
      });
      expect(event.sequenceNumber).toBe(42);
      expect(event.eventType).toBe("StateCheckpointed");
    });

    it("validates TrajectoryStep and TrajectorySession (Prime-Agent pattern)", () => {
      const step = TrajectoryStepSchema.parse({
        agentId,
        taskId,
        stepIndex: 0,
        action: {
          name: "compile",
          parameters: { command: "tsc" },
        },
        observation: {
          output: "Success",
          isError: false,
        },
        verificationStatus: "passed",
      });
      expect(step.verificationStatus).toBe("passed");

      const session = TrajectorySessionSchema.parse({
        sessionId: "55555555-5555-4555-a555-555555555555",
        agentId,
        taskId,
        steps: [step],
        finalStatus: "completed",
      });
      expect(session.steps).toHaveLength(1);
    });
  });

  describe("8. Filesystem & Configuration Schemas", () => {
    it("validates GlobalConfig defaults and model routes", () => {
      const config = GlobalConfigSchema.parse({});
      expect(config.version).toBe("1.0.0");
      expect(config.ports.websocketPort).toBe(19840);
      expect(config.ports.rpcPort).toBe(19841);
      expect(config.browser.maxContexts).toBe(2);
      expect(config.defaultRoutes.orchestrator.provider).toBe("anthropic");
    });

    it("validates Agent Markdown configuration specs", () => {
      const manifest = AgentPermissionsManifestSchema.parse({
        allowedSubAgents: ["coder", "researcher"],
        maxDepth: 2,
        maxConcurrentChildren: 3,
      });
      expect(manifest.allowedSubAgents).toContain("coder");

      const soul = AgentSoulSpecSchema.parse({
        reasoningStyle: "strict",
        verificationPriority: "high",
      });
      expect(soul.reasoningStyle).toBe("strict");

      const identity = AgentIdentitySpecSchema.parse({
        provider: "anthropic",
        model: "claude-3-7-sonnet-20250219",
        tools: ["sqlite__query", "vcs__diff"],
      });
      expect(identity.tools).toHaveLength(2);

      const memory = AgentMemorySpecSchema.parse({
        facts: ["User prefers pnpm over npm"],
        patterns: ["TypeScript monorepo with composite projects"],
        strategies: ["Verify build before committing"],
      });
      expect(memory.facts).toHaveLength(1);

      const bootstrap = AgentBootstrapSpecSchema.parse({
        isInitialized: false,
        onboardingQuestions: [
          { id: "q1", question: "What is your main language?" },
        ],
      });
      expect(bootstrap.isInitialized).toBe(false);
    });

    it("validates VaultCredential schema for OS keyring storage", () => {
      const cred = VaultCredentialSchema.parse({
        providerId: "anthropic",
        apiKey: "sk-ant-api03-sample",
      });
      expect(cred.providerId).toBe("anthropic");
      expect(cred.apiKey).toBe("sk-ant-api03-sample");
    });
  });

  describe("10. Phase 4: Perception & Interaction Engine Contracts", () => {
    it("validates AXNode and AXTreeSnapshot schemas", () => {
      const node = AXNodeSchema.parse({
        id: 1,
        role: "button",
        name: "Submit Order",
        bounds: { x: 120, y: 340, width: 100, height: 40 },
        isActionable: true,
        children: [],
      });
      expect(node.id).toBe(1);
      expect(node.role).toBe("button");
      expect(node.isActionable).toBe(true);

      const snapshot = AXTreeSnapshotSchema.parse({
        url: "https://example.com/checkout",
        title: "Checkout",
        totalRawNodes: 1200,
        interactiveNodes: [node],
        prunedNodeCount: 1199,
        reductionPercentage: 99.9,
      });
      expect(snapshot.interactiveNodes).toHaveLength(1);
      expect(snapshot.reductionPercentage).toBeGreaterThanOrEqual(90);
    });

    it("validates BrowserActionRequest and BrowserPoolStats", () => {
      const action = BrowserActionRequestSchema.parse({
        action: "click",
        targetId: 1,
        agentName: "ScraperBot",
      });
      expect(action.action).toBe("click");
      expect(action.targetId).toBe(1);

      const stats = BrowserPoolStatsSchema.parse({
        activeContextCount: 2,
        maxContexts: 2,
        idleContextCount: 0,
        recycledCount: 3,
      });
      expect(stats.activeContextCount).toBeLessThanOrEqual(stats.maxContexts);
    });

    it("validates PtySessionConfig and PtyOutputEvent", () => {
      const config = PtySessionConfigSchema.parse({
        command: "powershell.exe",
        args: ["-NoProfile"],
        cols: 120,
        rows: 30,
      });
      expect(config.command).toBe("powershell.exe");

      const event = PtyOutputEventSchema.parse({
        sessionId: config.sessionId,
        raw: "\x1b[32mSuccess\x1b[0m\n",
        cleaned: "Success\n",
      });
      expect(event.cleaned).toBe("Success\n");
    });

    it("validates CodeSymbol and RepositoryIndex", () => {
      const symbol = CodeSymbolSchema.parse({
        name: "BrowserContextPool",
        kind: "class",
        filePath: "src/browser/browser.ts",
        startLine: 10,
        endLine: 150,
        isExported: true,
      });
      expect(symbol.name).toBe("BrowserContextPool");

      const repo = RepositoryIndexSchema.parse({
        rootPath: "/workspace",
        totalFiles: 10,
        symbols: [symbol],
        imports: [{ fromPath: "a.ts", toPath: "b.ts", importedSymbols: ["foo"] }],
        indexedLanguages: ["typescript"],
        durationMs: 42,
      });
      expect(repo.symbols).toHaveLength(1);
    });

    it("validates DesktopWindowInfo and DesktopUINode", () => {
      const win = DesktopWindowInfoSchema.parse({
        id: "win-1",
        title: "Krypton Dashboard",
        processName: "krypton.exe",
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        isFocused: true,
      });
      expect(win.isFocused).toBe(true);

      const uiNode = DesktopUINodeSchema.parse({
        id: "btn-start",
        name: "Start Task",
        role: "button",
        bounds: { x: 50, y: 100, width: 80, height: 30 },
      });
      expect(uiNode.role).toBe("button");
    });
  });
});
