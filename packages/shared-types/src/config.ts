import { z } from "zod";

/**
 * Model routing selection for specific agent capabilities.
 */
export const ModelRouteSchema = z.object({
  provider: z.string().min(1, "Provider identifier is required"),
  model: z.string().min(1, "Model name is required"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
});
export type ModelRoute = z.infer<typeof ModelRouteSchema>;

/**
 * Supported Voice-To-Text (VTT) speech transcription engine architectures.
 * - `whisper_local`: Autoregressive encoder-decoder transformer running locally (Whisper.cpp / ONNX)
 * - `whisper_api`: OpenAI Audio Transcriptions REST API
 * - `nvidia/parakeet-tdt-0.6b-v3`: Fast Conformer RNN-T / TDT streaming transducer (0.6B params, ultra-low latency)
 * - `custom`: User-configured custom STT endpoint
 */
export const VttEngineIdSchema = z.enum([
  "whisper_local",
  "whisper_gguf",
  "moonshine_onnx",
  "whisper_api",
  "nvidia/parakeet-tdt-0.6b-v3",
  "custom",
]);
export type VttEngineId = z.infer<typeof VttEngineIdSchema>;

export const VttConfigSchema = z.object({
  engine: z.string().default("whisper_local"),
  architecture: z
    .enum([
      "encoder_decoder_autoregressive",
      "whisper_gguf",
      "moonshine_onnx",
      "conformer_rnnt_tdt",
      "cloud_api",
      "custom",
    ])
    .default("encoder_decoder_autoregressive"),
  customEndpoint: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  sampleRate: z.number().int().default(16000),
});
export type VttConfig = z.infer<typeof VttConfigSchema>;

/**
 * Global application configuration stored at `~/.krypton/config.json`.
 */
export const GlobalConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  isInitialized: z.boolean().default(false),
  customAgentName: z.string().default("Orchestrator"),
  defaultWorkspaceDir: z.string().optional(),
  defaultTerminalShell: z.string().default("system"),
  askForApproval: z.boolean().default(true),
  astSafetyEnforced: z.boolean().default(true),
  vtt: VttConfigSchema.default({}),
  appearance: z
    .object({
      theme: z.enum(["dark", "midnight", "cyber", "oled"]).default("dark"),
      fontSize: z.enum(["compact", "standard", "comfortable"]).default("standard"),
      density: z.enum(["compact", "comfortable"]).default("comfortable"),
    })
    .default({}),
  activeProviders: z.array(z.string()).default(["anthropic", "openai"]),
  defaultRoutes: z
    .object({
      orchestrator: ModelRouteSchema.default({
        provider: "anthropic",
        model: "claude-3-7-sonnet-20250219",
      }),
      coder: ModelRouteSchema.default({
        provider: "anthropic",
        model: "claude-3-7-sonnet-20250219",
      }),
      fast: ModelRouteSchema.default({
        provider: "openai",
        model: "gpt-4o-mini",
      }),
      vision: ModelRouteSchema.default({
        provider: "openai",
        model: "gpt-4o",
      }),
    })
    .default({}),
  hotkeys: z
    .object({
      toggleVoiceHud: z.string().default("CommandOrControl+Shift+Space"),
      toggleSynapse: z.string().default("CommandOrControl+Shift+Space"),
      abortExecution: z.string().default("CommandOrControl+Escape"),
    })
    .default({}),
  ports: z
    .object({
      websocketPort: z.number().int().positive().default(19840),
      rpcPort: z.number().int().positive().default(19841),
    })
    .default({}),
  browser: z
    .object({
      headless: z.boolean().default(false),
      maxContexts: z.number().int().min(1).max(2).default(2),
      idleTimeoutMinutes: z.number().int().positive().default(15),
      defaultViewport: z
        .object({
          width: z.number().int().positive().default(1280),
          height: z.number().int().positive().default(800),
        })
        .default({}),
    })
    .default({}),
  telemetry: z
    .object({
      enabled: z.boolean().default(false),
      logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
    })
    .default({}),
});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

/**
 * Structured permissions assigned to an agent instance, stored in its `config.json`.
 */
export const AgentPermissionsConfigSchema = z.object({
  allowedSubAgents: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default(["terminal", "filesystem", "astLinter"]),
  maxDepth: z.number().int().min(0).max(3).default(3),
  maxConcurrentChildren: z.number().int().min(1).max(5).default(5),
  budgetShare: z.number().min(0).max(1).default(0.5),
  canSynthesizeTools: z.boolean().default(true),
  canAccessNetwork: z.boolean().default(true),
  canModifyWorkspace: z.boolean().default(true),
  terminal: z.boolean().default(true),
  filesystem: z.boolean().default(true),
  web: z.boolean().default(false),
  astLinter: z.boolean().default(true),
});
export type AgentPermissionsConfig = z.infer<typeof AgentPermissionsConfigSchema>;

/**
 * Token budget configuration stored in `config.json`.
 */
export const AgentBudgetConfigSchema = z.object({
  total: z.number().int().positive().default(100_000),
  used: z.number().int().nonnegative().default(0),
});
export type AgentBudgetConfig = z.infer<typeof AgentBudgetConfigSchema>;

/**
 * Machine-readable configuration schema stored strictly at `~/.krypton/agents/<name>/config.json`.
 * Dedicated exclusively to machine configuration, model parameters, API provider references,
 * tool declarations, permissions, and runtime metadata.
 * Context and prompts live in pure Markdown files (*.md).
 */
export const AgentConfigFileSchema = z.object({
  id: z.string().min(1, "Agent ID is required"),
  name: z.string().min(1, "Agent name is required"),
  role: z.string().default("Autonomous Desktop AI Agent"),
  model: z.string().default("claude-3-7-sonnet-20250219"),
  provider: z.string().default("anthropic"),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().optional(),
  contextWindowLimit: z.number().int().positive().default(128_000),
  tools: z.array(z.string()).default(["terminal", "filesystem", "astLinter"]),
  permissions: AgentPermissionsConfigSchema.default({}),
  budget: AgentBudgetConfigSchema.default({}),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AgentConfigFile = z.infer<typeof AgentConfigFileSchema>;

/**
 * Factory to create a fully initialized default AgentConfigFile with safe fallbacks.
 */
export function createDefaultAgentConfig(
  name: string,
  overrides?: Partial<AgentConfigFile>
): AgentConfigFile {
  const sanitizedName = name.trim();
  const id = overrides?.id || `agent-${sanitizedName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;
  return AgentConfigFileSchema.parse({
    id,
    name: sanitizedName,
    ...overrides,
  });
}

/**
 * Specification for AGENTS.md declaring sub-agent permissions and recursion bounds.
 * (Preserved for backwards compatibility with legacy manifest parsers).
 */
export const AgentPermissionsManifestSchema = z.object({
  allowedSubAgents: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  maxDepth: z.number().int().min(0).max(3).default(3),
  maxConcurrentChildren: z.number().int().min(1).max(5).default(5),
  budgetShare: z.number().min(0).max(1).default(0.5),
  canSynthesizeTools: z.boolean().default(true),
  canAccessNetwork: z.boolean().default(true),
  canModifyWorkspace: z.boolean().default(true),
});
export type AgentPermissionsManifest = z.infer<
  typeof AgentPermissionsManifestSchema
>;

/**
 * Specification for SOUL.md defining immutable reasoning style and safety directives.
 */
export const AgentSoulSpecSchema = z.object({
  personality: z.string().default("Objective, analytical, precise autonomous agent"),
  reasoningStyle: z
    .enum(["analytical", "intuitive", "strict", "exploratory"])
    .default("strict"),
  tone: z.string().default("concise"),
  safetyDirectives: z.array(z.string()).default([]),
  verificationPriority: z
    .enum(["high", "medium", "speed_first"])
    .default("high"),
  rawMarkdown: z.string().optional(),
});
export type AgentSoulSpec = z.infer<typeof AgentSoulSpecSchema>;

/**
 * Specification for IDENTITY.md specifying model provider, system prompt, and tools.
 */
export const AgentIdentitySpecSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  model: z.string().min(1, "Model name is required"),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().default(""),
  tools: z.array(z.string()).default([]),
  contextWindowLimit: z.number().int().positive().default(128_000),
});
export type AgentIdentitySpec = z.infer<typeof AgentIdentitySpecSchema>;

/**
 * Specification for USER.md capturing user preferences and domain guidelines.
 */
export const AgentUserPreferencesSpecSchema = z.object({
  userName: z.string().default("User"),
  preferences: z.record(z.string(), z.unknown()).default({}),
  domainGuidelines: z.array(z.string()).default([]),
  rawMarkdown: z.string().optional(),
});
export type AgentUserPreferencesSpec = z.infer<
  typeof AgentUserPreferencesSpecSchema
>;

/**
 * Specification for MEMORY.md capturing distilled long-term knowledge.
 */
export const AgentMemorySpecSchema = z.object({
  facts: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
  strategies: z.array(z.string()).default([]),
  lastDistilledAt: z.number().int().nonnegative().default(() => Date.now()),
  rawMarkdown: z.string().optional(),
});
export type AgentMemorySpec = z.infer<typeof AgentMemorySpecSchema>;

/**
 * Specification for BOOTSTRAP.md used during initial agent onboarding.
 */
export const AgentBootstrapSpecSchema = z.object({
  isInitialized: z.boolean().default(false),
  onboardingQuestions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        answer: z.string().optional(),
      })
    )
    .default([]),
  initialTasks: z.array(z.string()).default([]),
  rawMarkdown: z.string().optional(),
});
export type AgentBootstrapSpec = z.infer<typeof AgentBootstrapSpecSchema>;

/**
 * Model credentials stored in the OS Native Keyring or encrypted vault.
 */
export const VaultCredentialSchema = z.object({
  providerId: z.string().min(1, "Provider identifier is required"),
  apiKey: z.string().min(1, "API Key is required"),
  baseUrl: z.string().url().optional(),
  organizationId: z.string().optional(),
  headers: z.record(z.string(), z.string()).default({}),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type VaultCredential = z.infer<typeof VaultCredentialSchema>;

export const VaultStoreSchema = z.record(z.string(), VaultCredentialSchema);
export type VaultStore = z.infer<typeof VaultStoreSchema>;

/**
 * Supported model provider identifiers for first-run setup and dynamic discovery.
 */
export const ModelProviderIdSchema = z.enum([
  "openai",
  "anthropic",
  "ollama",
  "openrouter",
  "custom",
]);
export type ModelProviderId = z.infer<typeof ModelProviderIdSchema>;

/**
 * Discovered model metadata discovered via dynamic provider endpoints.
 */
export const DiscoveredModelSchema = z.object({
  id: z.string().min(1, "Model ID is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  contextLength: z.number().int().positive().optional(),
  created: z.number().int().nonnegative().optional(),
  ownedBy: z.string().optional(),
});
export type DiscoveredModel = z.infer<typeof DiscoveredModelSchema>;

/**
 * Cached models stored locally at `~/.krypton/models_cache.json`.
 */
export const CachedModelsDataSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().optional(),
  models: z.array(DiscoveredModelSchema).default([]),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type CachedModelsData = z.infer<typeof CachedModelsDataSchema>;

/**
 * Model discovery request parameters.
 */
export const ModelDiscoveryRequestSchema = z.object({
  provider: ModelProviderIdSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});
export type ModelDiscoveryRequest = z.infer<typeof ModelDiscoveryRequestSchema>;

/**
 * Model discovery response payload.
 */
export const ModelDiscoveryResponseSchema = z.object({
  success: z.boolean(),
  provider: ModelProviderIdSchema,
  models: z.array(DiscoveredModelSchema).default([]),
  error: z.string().optional(),
});
export type ModelDiscoveryResponse = z.infer<typeof ModelDiscoveryResponseSchema>;

/**
 * First-run onboarding setup payload submitted from the interactive setup wizard.
 */
export const SetupConfigPayloadSchema = z.object({
  agentName: z.string().min(1, "Agent name is required").default("Orchestrator"),
  agentRole: z.string().default("Autonomous Desktop AI Agent"),
  provider: z.string().default("openai"),
  primaryModel: z.string().default("5.6 Terra High"),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
      openrouter: z.string().optional(),
      customEndpoint: z.string().optional(),
      customModel: z.string().optional(),
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
    })
    .default({}),
  cachedModels: z.array(DiscoveredModelSchema).optional(),
  defaultWorkspaceDir: z.string().default(""),
  askForApproval: z.boolean().default(true),
  astSafetyEnforced: z.boolean().default(true),
  telemetryEnabled: z.boolean().default(false),
  vttEngine: z.string().default("whisper_local"),
  vttCustomEndpoint: z.string().optional(),
  vttApiKey: z.string().optional(),
});
export type SetupConfigPayload = z.infer<typeof SetupConfigPayloadSchema>;

/**
 * Record representing a project workspace saved to disk at ~/.krypton/workspaces/<id>.json.
 */
export const WorkspaceRecordSchema = z.object({
  id: z.string().min(1, "Workspace ID is required"),
  name: z.string().min(1, "Workspace name is required"),
  path: z.string().default(""),
  branch: z.string().default("main"),
  activeThreadId: z.string().default(""),
  activeAgentId: z.string().optional(),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
  settings: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).passthrough();
export type WorkspaceRecord = z.infer<typeof WorkspaceRecordSchema>;

/**
 * Individual message entry within a persisted chat session thread.
 */
export const SessionMessageRecordSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  sender: z.enum(["user", "agent", "system"]).optional(),
  role: z.string().optional(),
  content: z.string().optional(),
  timestamp: z.number().int().nonnegative().default(() => Date.now()),
  prompt: z.string().optional(),
  codeSnippet: z.string().optional(),
  configJson: z.string().optional(),
  assistantText: z.string().optional(),
  toolExecutions: z.array(z.record(z.string(), z.unknown())).optional(),
  thoughtTrace: z.record(z.string(), z.unknown()).optional(),
  tasks: z.array(z.record(z.string(), z.unknown())).optional(),
  diffData: z.record(z.string(), z.unknown()).optional(),
  approvalGate: z.record(z.string(), z.unknown()).optional(),
}).passthrough().transform((data) => {
  let sender: "user" | "agent" | "system" = data.sender || "user";
  if (!data.sender && data.role) {
    sender = data.role === "assistant" ? "agent" : data.role === "system" ? "system" : "user";
  }
  let prompt = data.prompt;
  let assistantText = data.assistantText;
  if (data.content) {
    if (sender === "user") {
      prompt = prompt || data.content;
    } else {
      assistantText = assistantText || data.content;
    }
  }
  return {
    ...data,
    sender,
    prompt,
    assistantText,
  };
});
export type SessionMessageRecord = z.infer<typeof SessionMessageRecordSchema>;

/**
 * Session thread record saved to disk at ~/.krypton/sessions/<id>.json.
 */
export const SessionThreadRecordSchema = z.object({
  id: z.string().min(1, "Session thread ID is required"),
  workspaceId: z.string().default(""),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  title: z.string().default("Initial Session"),
  createdAt: z.number().int().nonnegative().default(() => Date.now()),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
  status: z.enum(["idle", "running", "completed", "error"]).default("idle"),
  messages: z.array(SessionMessageRecordSchema).default([]),
  summary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).passthrough();
export type SessionThreadRecord = z.infer<typeof SessionThreadRecordSchema>;

/**
 * Complete persisted workstation state container for filesystem storage.
 */
export const PersistedWorkstationStateSchema = z.object({
  version: z.number().default(2),
  workspaces: z.array(WorkspaceRecordSchema).default([]),
  activeWorkspaceId: z.string().default(""),
  activeThreadId: z.string().default(""),
  activeSessionId: z.string().optional(),
  activeAgentId: z.string().optional(),
  sidebarOpen: z.boolean().optional(),
  activeTab: z.string().optional(),
  recentWorkspaceIds: z.array(z.string()).optional(),
  sessions: z.array(SessionThreadRecordSchema).default([]),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
}).passthrough();
export type PersistedWorkstationState = z.infer<typeof PersistedWorkstationStateSchema>;


