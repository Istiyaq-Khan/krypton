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
 * Global application configuration stored at `~/.krypton/config.json`.
 */
export const GlobalConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  isInitialized: z.boolean().default(false),
  customAgentName: z.string().default("Orchestrator"),
  defaultWorkspaceDir: z.string().optional(),
  askForApproval: z.boolean().default(true),
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
 * Specification for AGENTS.md declaring sub-agent permissions and recursion bounds.
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
 * First-run onboarding setup payload submitted from the interactive setup wizard.
 */
export const SetupConfigPayloadSchema = z.object({
  agentName: z.string().min(1, "Agent name is required").default("Orchestrator"),
  agentRole: z.string().default("Autonomous Desktop AI Agent"),
  primaryModel: z.string().default("5.6 Terra High"),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
      customEndpoint: z.string().optional(),
      customModel: z.string().optional(),
    })
    .default({}),
  defaultWorkspaceDir: z.string().default(""),
  askForApproval: z.boolean().default(true),
  astSafetyEnforced: z.boolean().default(true),
  telemetryEnabled: z.boolean().default(false),
});
export type SetupConfigPayload = z.infer<typeof SetupConfigPayloadSchema>;

