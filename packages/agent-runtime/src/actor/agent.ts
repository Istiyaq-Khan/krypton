import * as fs from "node:fs";
import * as path from "node:path";
import { EventEmitter } from "node:events";
import {
  AgentContext,
  AgentContextSchema,
  AgentState,
  Message,
  MessageSchema,
  Role,
  TokenBudget,
  TokenBudgetSchema,
  RecursionBoundary,
  RecursionBoundarySchema,
  ToolCall,
  ToolResult,
} from "@krypton/shared-types";
import { AgentStateManager } from "./state.js";
import {
  ActorScheduler,
  RecursionCeilingExceededError,
  TokenBudgetExhaustedError,
} from "./scheduler.js";
import { DualBufferQueue } from "../steering/dual-buffer-queue.js";
import { AgentEventStore } from "../event-sourcing/event-store.js";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";
import {
  readAgentConfig,
  readAgentContextMarkdown,
  updateAgentConfig,
  deleteBootstrapFile,
  resolveAgentDir,
} from "../filesystem/agent-storage.js";
import { AgentConfigFile } from "@krypton/shared-types";
import { LLMProvider } from "../providers/types.js";
import { ObservationOffloader } from "../context/offloader.js";

export interface AgentConfig {
  agentId?: string;
  name: string;
  role?: string;
  personaMetadata?: Record<string, unknown>;
  parentAgentId?: string | null;
  recursionDepth?: number;
  tokenBudget?: Partial<TokenBudget>;
  recursionBoundary?: Partial<RecursionBoundary>;
  systemPrompt?: string;
  soulDirectives?: string;
  agentsDirectives?: string;
  bootstrapDirectives?: string;
  provider?: LLMProvider;
  scheduler?: ActorScheduler;
  eventStore?: AgentEventStore;
  customRoot?: string;
  toolExecutor?: (toolCall: ToolCall) => Promise<ToolResult>;
}

export interface SpawnChildOptions {
  role: string;
  taskDescription: string;
  name?: string;
  budgetAllocation?: number;
  timeoutMs?: number;
  provider?: LLMProvider;
  toolExecutor?: (toolCall: ToolCall) => Promise<ToolResult>;
}

export interface AgentStepResult {
  state: AgentState;
  message?: Message;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  terminal: boolean;
}

/**
 * Universal Agent Actor Class.
 * Every sub-agent is a universal Actor instance with private context,
 * isolated messages, dynamic tool execution, and child delegation capabilities.
 */
export class Agent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly context: AgentContext;
  public readonly stateManager: AgentStateManager;
  public readonly steeringQueue: DualBufferQueue;
  public readonly eventStore: AgentEventStore;
  public readonly scheduler: ActorScheduler;

  private messages: Message[] = [];
  private provider?: LLMProvider;
  private toolExecutor?: (toolCall: ToolCall) => Promise<ToolResult>;
  private customRoot?: string;
  private systemPrompt: string;
  private soulDirectives: string;
  private agentsDirectives: string;
  private bootstrapDirectives: string;
  private activeAbortController?: AbortController;
  private cleanupAbort?: () => void;

  constructor(config: AgentConfig) {
    super();
    this.id = config.agentId ?? crypto.randomUUID();
    this.name = config.name;
    this.customRoot = config.customRoot;
    this.provider = config.provider;
    this.toolExecutor = config.toolExecutor;
    this.systemPrompt = config.systemPrompt ?? "";
    this.soulDirectives = config.soulDirectives ?? "";
    this.agentsDirectives = config.agentsDirectives ?? "";
    this.bootstrapDirectives = config.bootstrapDirectives ?? "";

    const parsedBudget = TokenBudgetSchema.parse({
      hardLimit: config.tokenBudget?.hardLimit ?? 100_000,
      usedTokens: config.tokenBudget?.usedTokens ?? 0,
      warningThreshold: config.tokenBudget?.warningThreshold ?? 0.85,
      childAllocationShare: config.tokenBudget?.childAllocationShare ?? 0.5,
    });

    const parsedBoundary = RecursionBoundarySchema.parse({
      maxDepth: config.recursionBoundary?.maxDepth ?? 3,
      maxConcurrentChildren: config.recursionBoundary?.maxConcurrentChildren ?? 5,
      timeoutMs: config.recursionBoundary?.timeoutMs ?? 60_000,
    });

    this.context = AgentContextSchema.parse({
      agentId: this.id,
      name: this.name,
      role: config.role ?? "general",
      personaMetadata: config.personaMetadata ?? {},
      parentAgentId: config.parentAgentId ?? null,
      recursionDepth: config.recursionDepth ?? 0,
      tokenBudget: parsedBudget,
      recursionBoundary: parsedBoundary,
      state: "idle",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.eventStore =
      config.eventStore ?? new AgentEventStore(this.name, this.customRoot);
    this.stateManager = new AgentStateManager({
      agentId: this.id,
      agentName: this.name,
      initialState: "idle",
      customRoot: this.customRoot,
      eventStore: this.eventStore,
    });

    this.steeringQueue = new DualBufferQueue();
    this.scheduler =
      config.scheduler ??
      ActorScheduler.getInstance({
        maxDepth: parsedBoundary.maxDepth,
        maxConcurrency: parsedBoundary.maxConcurrentChildren,
        defaultTimeoutMs: parsedBoundary.timeoutMs,
      });

    // Mirror stateManager transitions to context
    this.stateManager.on("stateChange", (event) => {
      this.context.state = event.newState;
      this.context.updatedAt = event.timestamp;
      this.emit("stateChange", event);
    });

    // Initialize system prompt message if present
    const combinedSystem = this.buildCombinedSystemPrompt();
    if (combinedSystem) {
      this.messages.push({
        id: crypto.randomUUID(),
        role: "system",
        content: combinedSystem,
        timestamp: Date.now(),
      });
    }
  }

  private buildCombinedSystemPrompt(): string {
    const parts: string[] = [];
    if (this.systemPrompt.trim()) {
      parts.push(this.systemPrompt.trim());
    }
    if (this.soulDirectives.trim()) {
      parts.push(`\n## Core Directives & Behavioral Guardrails\n${this.soulDirectives.trim()}`);
    }
    if (this.agentsDirectives.trim()) {
      parts.push(`\n## Workspace Conventions & Operational Directives\n${this.agentsDirectives.trim()}`);
    }
    if (this.bootstrapDirectives.trim()) {
      parts.push(
        [
          "=================================================================",
          "CRITICAL ONBOARDING DIRECTIVE: ACTIVE BOOTSTRAP PROTOCOL DETECTED",
          "=================================================================",
          "You are currently executing the first-run birth sequence specified below. Complete the onboarding beats in order.",
          "You (the agent) alone are responsible for verifying your setup and deleting BOOTSTRAP.md via file tools once all beats are verified.",
          "The Krypton system will NEVER automatically delete this file for you.",
          "",
          "FILE CONTENT:",
          this.bootstrapDirectives.trim(),
          "=================================================================",
        ].join("\n")
      );
    }
    return parts.join("\n\n");
  }

  /**
   * Factory method to load an agent instance directly from its disk folder (~/.krypton/agents/<name>).
   * Enforces strict separation of concerns:
   * - Machine configuration loaded exclusively from `config.json` via readAgentConfig().
   * - Prompts, behavioral directives, and active bootstrap instructions loaded as pure markdown text via readAgentContextMarkdown().
   */
  public static async fromWorkspace(
    agentNameOrDir: string,
    options?: {
      customRoot?: string;
      provider?: LLMProvider;
      scheduler?: ActorScheduler;
      toolExecutor?: (toolCall: ToolCall) => Promise<ToolResult>;
    }
  ): Promise<Agent> {
    const { agentName, agentDir } = resolveAgentDir(agentNameOrDir, options?.customRoot);
    const effectiveCustomRoot =
      options?.customRoot ||
      (path.isAbsolute(agentNameOrDir) ? path.dirname(path.dirname(agentDir)) : undefined);

    const config = await readAgentConfig(agentDir, {
      customRoot: effectiveCustomRoot,
    });

    // Load pure markdown context without config keys or frontmatter leakage
    const [systemPrompt, soulDirectives, agentsDirectives, bootstrapDirectives] = await Promise.all([
      readAgentContextMarkdown(agentDir, "IDENTITY.md", {
        customRoot: effectiveCustomRoot,
      }),
      readAgentContextMarkdown(agentDir, "SOUL.md", {
        customRoot: effectiveCustomRoot,
      }),
      readAgentContextMarkdown(agentDir, "AGENTS.md", {
        customRoot: effectiveCustomRoot,
      }),
      readAgentContextMarkdown(agentDir, "BOOTSTRAP.md", {
        customRoot: effectiveCustomRoot,
      }),
    ]);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.id);
    const agentId = isUuid ? config.id : crypto.randomUUID();

    return new Agent({
      agentId,
      name: config.name,
      role: config.role,
      systemPrompt,
      soulDirectives,
      agentsDirectives,
      bootstrapDirectives,
      tokenBudget: {
        hardLimit: config.budget?.total ?? 100_000,
        usedTokens: config.budget?.used ?? 0,
      },
      recursionBoundary: {
        maxDepth: config.permissions?.maxDepth ?? 3,
        maxConcurrentChildren: config.permissions?.maxConcurrentChildren ?? 5,
      },
      customRoot: effectiveCustomRoot,
      provider: options?.provider,
      scheduler: options?.scheduler,
      toolExecutor: options?.toolExecutor,
    });
  }

  /**
   * Reads the active machine configuration from `config.json`.
   */
  public async getConfig(): Promise<AgentConfigFile> {
    return readAgentConfig(this.name, { customRoot: this.customRoot });
  }

  /**
   * Updates settings strictly within `config.json` without modifying markdown files.
   */
  public async updateConfig(patch: Partial<AgentConfigFile>): Promise<AgentConfigFile> {
    return updateAgentConfig(this.name, patch, { customRoot: this.customRoot });
  }

  public getMessages(): Message[] {
    return [...this.messages];
  }

  public getSystemPrompt(): string {
    return this.buildCombinedSystemPrompt();
  }

  public getState(): AgentState {
    return this.stateManager.getState();
  }

  public setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  public setToolExecutor(
    executor: (toolCall: ToolCall) => Promise<ToolResult>
  ): void {
    this.toolExecutor = executor;
  }

  /**
   * Spawns an isolated sub-agent under hierarchical recursion limits.
   * Ensures parent context is never leaked, only the clean task objective is injected.
   */
  public async spawnChild(options: SpawnChildOptions): Promise<Agent> {
    const nextDepth = this.context.recursionDepth + 1;
    const canSpawn = this.scheduler.canSpawnChild(this.context.recursionDepth);

    if (!canSpawn.allowed) {
      throw new RecursionCeilingExceededError(
        nextDepth,
        this.context.recursionBoundary.maxDepth
      );
    }

    // Allocate token budget from parent
    const remainingParentTokens =
      this.context.tokenBudget.hardLimit - this.context.tokenBudget.usedTokens;
    let childAllocation = options.budgetAllocation;

    if (!childAllocation || childAllocation <= 0) {
      childAllocation = Math.floor(
        remainingParentTokens * this.context.tokenBudget.childAllocationShare
      );
    }

    if (childAllocation > remainingParentTokens) {
      childAllocation = remainingParentTokens;
    }

    // Acquire concurrency slot (max 5)
    await this.scheduler.acquireSlot(this.activeAbortController?.signal);

    const childName =
      options.name ??
      `${this.name}_child_${options.role}_${crypto.randomUUID().slice(0, 6)}`;

    // Create child timeout abort controller bound to parent
    const timeoutMs =
      options.timeoutMs ?? this.context.recursionBoundary.timeoutMs;
    const { controller, cleanup } = this.scheduler.createChildAbortController(
      this.activeAbortController?.signal,
      timeoutMs
    );

    const childAgent = new Agent({
      agentId: crypto.randomUUID(),
      name: childName,
      role: options.role,
      parentAgentId: this.id,
      recursionDepth: nextDepth,
      customRoot: this.customRoot,
      provider: options.provider ?? this.provider,
      toolExecutor: options.toolExecutor ?? this.toolExecutor,
      scheduler: this.scheduler,
      tokenBudget: {
        hardLimit: Math.max(childAllocation, 1_000),
        usedTokens: 0,
        warningThreshold: this.context.tokenBudget.warningThreshold,
        childAllocationShare: this.context.tokenBudget.childAllocationShare,
      },
      recursionBoundary: {
        maxDepth: this.context.recursionBoundary.maxDepth,
        maxConcurrentChildren:
          this.context.recursionBoundary.maxConcurrentChildren,
        timeoutMs,
      },
    });

    childAgent.activeAbortController = controller;
    childAgent.cleanupAbort = cleanup;

    // Register in scheduler
    this.scheduler.registerActor({
      agentId: childAgent.id,
      name: childAgent.name,
      depth: childAgent.context.recursionDepth,
      tokenBudget: childAgent.context.tokenBudget,
      abortController: controller,
      parentAgentId: this.id,
      startedAt: Date.now(),
    });

    // Cleanup upon child termination
    childAgent.stateManager.on("stateChange", (event) => {
      if (childAgent.stateManager.isTerminal()) {
        cleanup();
        this.scheduler.releaseActor(childAgent.id);
        // Track child tokens used back into parent
        const childUsed = childAgent.context.tokenBudget.usedTokens;
        if (childUsed > 0) {
          try {
            this.scheduler.deductTokens(this.id, childUsed);
            this.context.tokenBudget.usedTokens += childUsed;
          } catch {
            // Handled via budget exhaustion
          }
        }
      }
    });

    // Seed child's message history strictly with its task description (zero parent conversation leak)
    childAgent.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: options.taskDescription,
      timestamp: Date.now(),
    });

    // Log spawn event
    await this.eventStore.appendEvent({
      eventType: "AgentSpawned",
      agentId: this.id,
      payload: {
        childAgentId: childAgent.id,
        childName: childAgent.name,
        childRole: options.role,
        recursionDepth: nextDepth,
        allocatedTokens: childAllocation,
      },
    });

    return childAgent;
  }

  /**
   * Executes a single autonomous step:
   * Observe -> Plan/Reflect -> Tool Execution -> Verification.
   */
  public async step(): Promise<AgentStepResult> {
    if (this.stateManager.isTerminal()) {
      return { state: this.getState(), terminal: true };
    }

    // 1. Observe: Check steering interrupts
    if (this.steeringQueue.hasSteeringInterrupt()) {
      const steeringEvents = this.steeringQueue.drainSteering();
      for (const steering of steeringEvents) {
        this.messages.push({
          id: crypto.randomUUID(),
          role: "user",
          content: `[MID-FLIGHT STEERING INTERRUPT]: ${steering.instruction}`,
          timestamp: Date.now(),
        });
        await this.eventStore.appendEvent({
          eventType: "SteeringInterrupted",
          agentId: this.id,
          payload: { instruction: steering.instruction, source: steering.source },
        });
      }
    }

    // 2. Plan / Reflect
    await this.stateManager.transitionTo("planning");

    if (!this.provider) {
      // Mock / fallback step when no provider is attached
      await this.stateManager.transitionTo("completed");
      return {
        state: "completed",
        terminal: true,
      };
    }

    // Generate LLM response
    let generateResult;
    try {
      generateResult = await this.provider.generate({
        agentId: this.id,
        messages: this.messages,
        abortSignal: this.activeAbortController?.signal,
      });
    } catch (err: any) {
      await this.stateManager.transitionTo("failed", err?.message || String(err));
      return {
        state: "failed",
        terminal: true,
      };
    }

    // Deduct tokens
    if (generateResult.usage?.totalTokens) {
      try {
        this.scheduler.deductTokens(this.id, generateResult.usage.totalTokens);
      } catch (err) {
        if (err instanceof TokenBudgetExhaustedError) {
          await this.stateManager.transitionTo("aborted", "Token budget exhausted");
          return { state: "aborted", terminal: true };
        }
        throw err;
      }
    }

    const assistantMsg = generateResult.message;
    this.messages.push(assistantMsg);

    const toolCalls = generateResult.toolCalls || [];

    // If no tool calls, completion reached
    if (toolCalls.length === 0) {
      await this.stateManager.transitionTo("completed");
      return {
        state: "completed",
        message: assistantMsg,
        terminal: true,
      };
    }

    // 3. Tool Execution
    await this.stateManager.transitionTo("executing");
    const toolResults: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      await this.eventStore.appendEvent({
        eventType: "ToolExecuting",
        agentId: this.id,
        payload: { toolName: toolCall.name, toolCallId: toolCall.id },
      });

      let result: ToolResult;
      if (this.toolExecutor) {
        try {
          result = await this.toolExecutor(toolCall);
        } catch (err: any) {
          result = {
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: `Tool execution error: ${err?.message || String(err)}`,
            isError: true,
          };
        }
      } else {
        result = await this.executeBuiltinTool(toolCall);
      }

      // Check output offloading (>1500 tokens / 6KB)
      const offloader = new ObservationOffloader({ customRoot: this.customRoot });
      const offloadRes = offloader.offloadIfNeeded(result.content, toolCall.id);

      const sanitizedResult: ToolResult = {
        toolCallId: result.toolCallId,
        toolName: result.toolName,
        content: offloadRes.content,
        isError: result.isError,
        metadata: {
          ...result.metadata,
          offloaded: offloadRes.isOffloaded,
          offloadDiskPath: offloadRes.offloadDiskPath,
        },
      };

      toolResults.push(sanitizedResult);

      await this.eventStore.appendEvent({
        eventType: "ToolFinished",
        agentId: this.id,
        payload: {
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          isError: sanitizedResult.isError,
          offloaded: offloadRes.isOffloaded,
        },
      });
    }

    // Append tool results to messages
    const toolResultMsg: Message = {
      id: crypto.randomUUID(),
      role: "tool",
      content: toolResults.map((r) => r.content).join("\n\n"),
      toolResults,
      timestamp: Date.now(),
    };
    this.messages.push(toolResultMsg);

    return {
      state: this.getState(),
      message: assistantMsg,
      toolCalls,
      toolResults,
      terminal: this.stateManager.isTerminal(),
    };
  }

  /**
   * Built-in file and workspace tool executor fallback.
   * Handles agent-governed file operations including deleting BOOTSTRAP.md upon verification.
   */
  /**
   * Built-in file and workspace tool executor fallback.
   * Handles agent-governed file operations including deleting BOOTSTRAP.md upon verification.
   */
  public async executeBuiltinTool(
    toolNameOrCall: string | ToolCall,
    args?: Record<string, any>
  ): Promise<ToolResult & { success: boolean; output: string }> {
    const call: ToolCall =
      typeof toolNameOrCall === "string"
        ? {
            id: `call-${Date.now()}`,
            name: toolNameOrCall,
            arguments: args || {},
          }
        : toolNameOrCall;

    const name = call.name.toLowerCase();
    if (
      name === "file_delete" ||
      name === "delete_file" ||
      name === "unlink" ||
      name === "remove_file"
    ) {
      const callArgs = (call.arguments as Record<string, any>) || {};
      const targetPath = String(
        callArgs.path || callArgs.filePath || callArgs.target || callArgs.file || ""
      );
      const fileName = path.basename(targetPath);
      if (fileName.toLowerCase() === "bootstrap.md") {
        const deleted = await deleteBootstrapFile(this.name, {
          customRoot: this.customRoot,
        });
        if (deleted) {
          this.bootstrapDirectives = "";
        }
        const output = deleted
          ? "Successfully deleted BOOTSTRAP.md from workspace. Onboarding birth sequence complete."
          : "BOOTSTRAP.md was not found or already deleted.";
        return {
          toolCallId: call.id,
          toolName: call.name,
          content: output,
          isError: !deleted,
          success: deleted,
          output,
        };
      }
    }

    const output = `No tool executor configured for tool '${call.name}'`;
    return {
      toolCallId: call.id,
      toolName: call.name,
      content: output,
      isError: true,
      success: false,
      output,
    };
  }

  /**
   * Autonomous execution loop running until completion, failure, or maxSteps.
   */
  public async run(objective: string, maxSteps = 20): Promise<string> {
    this.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: objective,
      timestamp: Date.now(),
    });

    let currentStep = 0;
    while (!this.stateManager.isTerminal() && currentStep < maxSteps) {
      currentStep++;
      const stepRes = await this.step();
      if (stepRes.terminal) break;
    }

    if (!this.stateManager.isTerminal() && currentStep >= maxSteps) {
      await this.stateManager.transitionTo("failed", "Max steps exceeded");
    }

    const lastMsg = this.messages[this.messages.length - 1];
    return lastMsg?.content ?? "";
  }
}
