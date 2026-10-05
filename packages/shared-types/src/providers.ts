import { z } from "zod";

/**
 * Standard protocol adapters supported across Krypton model providers.
 */
export const ProviderProtocolSchema = z.enum(["openai", "anthropic", "custom"]);
export type ProviderProtocol = z.infer<typeof ProviderProtocolSchema>;

/**
 * Type-safe model credentials supporting direct plain-text tokens,
 * environment variable references, and local secure encrypted vault entries.
 */
export const PlainTextCredentialSchema = z.object({
  type: z.literal("plain_text").default("plain_text"),
  token: z.string().min(1, "Token cannot be empty"),
});
export type PlainTextCredential = z.infer<typeof PlainTextCredentialSchema>;

export const EnvVarCredentialSchema = z.object({
  type: z.literal("env_var"),
  envVar: z.string().min(1, "Environment variable name is required"),
});
export type EnvVarCredential = z.infer<typeof EnvVarCredentialSchema>;

export const VaultCredentialRefSchema = z.object({
  type: z.literal("vault"),
  keyId: z.string().min(1, "Vault secret key identifier is required"),
});
export type VaultCredentialRef = z.infer<typeof VaultCredentialRefSchema>;

export const ModelCredentialSchema = z.discriminatedUnion("type", [
  PlainTextCredentialSchema,
  EnvVarCredentialSchema,
  VaultCredentialRefSchema,
]);
export type ModelCredential = z.infer<typeof ModelCredentialSchema>;

/**
 * Helper to normalize credentials from flexible input (plain string or structured object).
 */
export function normalizeCredential(
  raw?: string | ModelCredential | null
): ModelCredential | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("env:") || trimmed.startsWith("$")) {
      const varName = trimmed.replace(/^(env:|\$)/, "").trim();
      return { type: "env_var", envVar: varName };
    }
    if (trimmed.startsWith("vault:")) {
      const keyId = trimmed.replace(/^vault:/, "").trim();
      return { type: "vault", keyId };
    }
    return { type: "plain_text", token: trimmed };
  }
  return ModelCredentialSchema.parse(raw);
}

/**
 * Metadata definition for a registered model provider in the catalog.
 */
export const ProviderCatalogItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  protocol: ProviderProtocolSchema.default("openai"),
  apiUrl: z.string().min(1),
  apiKeyUrl: z.string().default(""),
  docs: z.string().default(""),
  isLocal: z.boolean().default(false),
});
export type ProviderCatalogItem = z.infer<typeof ProviderCatalogItemSchema>;
export type CatalogProvider = ProviderCatalogItem;
export type CredentialRef = ModelCredential;

/**
 * Complete catalog of 64 pre-configured AI model providers in the Krypton system.
 */
export const PROVIDER_CATALOG: ProviderCatalogItem[] = [
  {
    id: "openai",
    name: "OpenAI",
    protocol: "openai",
    apiUrl: "https://api.openai.com/v1",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    docs: "https://platform.openai.com/docs",
    isLocal: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    protocol: "anthropic",
    apiUrl: "https://api.anthropic.com/v1",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    docs: "https://docs.anthropic.com",
    isLocal: false,
  },
  {
    id: "google",
    name: "Google (Gemini)",
    protocol: "openai",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    docs: "https://ai.google.dev/gemini-api/docs",
    isLocal: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai",
    apiUrl: "https://api.deepseek.com/v1",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    docs: "https://api-docs.deepseek.com",
    isLocal: false,
  },
  {
    id: "groq",
    name: "Groq",
    protocol: "openai",
    apiUrl: "https://api.groq.com/openai/v1",
    apiKeyUrl: "https://console.groq.com/keys",
    docs: "https://console.groq.com/docs",
    isLocal: false,
  },
  {
    id: "mistral",
    name: "Mistral",
    protocol: "openai",
    apiUrl: "https://api.mistral.ai/v1",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    docs: "https://docs.mistral.ai",
    isLocal: false,
  },
  {
    id: "together",
    name: "Together AI",
    protocol: "openai",
    apiUrl: "https://api.together.xyz/v1",
    apiKeyUrl: "https://api.together.ai/settings/api-keys",
    docs: "https://docs.together.ai",
    isLocal: false,
  },
  {
    id: "fireworks",
    name: "Fireworks",
    protocol: "openai",
    apiUrl: "https://api.fireworks.ai/inference/v1",
    apiKeyUrl: "https://fireworks.ai/account/api-keys",
    docs: "https://docs.fireworks.ai",
    isLocal: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    protocol: "openai",
    apiUrl: "https://api.perplexity.ai",
    apiKeyUrl: "https://www.perplexity.ai/settings/api",
    docs: "https://docs.perplexity.ai",
    isLocal: false,
  },
  {
    id: "xai",
    name: "xAI",
    protocol: "openai",
    apiUrl: "https://api.x.ai/v1",
    apiKeyUrl: "https://console.x.ai",
    docs: "https://docs.x.ai",
    isLocal: false,
  },
  {
    id: "cohere",
    name: "Cohere",
    protocol: "openai",
    apiUrl: "https://api.cohere.com/v2",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    docs: "https://docs.cohere.com",
    isLocal: false,
  },
  {
    id: "cerebras",
    name: "Cerebras",
    protocol: "openai",
    apiUrl: "https://api.cerebras.ai/v1",
    apiKeyUrl: "https://cloud.cerebras.ai/platform",
    docs: "https://inference-docs.cerebras.ai",
    isLocal: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    protocol: "openai",
    apiUrl: "https://openrouter.ai/api/v1",
    apiKeyUrl: "https://openrouter.ai/keys",
    docs: "https://openrouter.ai/docs",
    isLocal: false,
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    protocol: "openai",
    apiUrl: "https://integrate.api.nvidia.com/v1",
    apiKeyUrl: "https://build.nvidia.com",
    docs: "https://docs.api.nvidia.com",
    isLocal: false,
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    protocol: "openai",
    apiUrl: "https://api.deepinfra.com/v1/openai",
    apiKeyUrl: "https://deepinfra.com/dash/api_keys",
    docs: "https://deepinfra.com/docs",
    isLocal: false,
  },
  {
    id: "novita",
    name: "NovitaAI",
    protocol: "openai",
    apiUrl: "https://api.novita.ai/v3/openai",
    apiKeyUrl: "https://novita.ai/dashboard/key",
    docs: "https://novita.ai/docs",
    isLocal: false,
  },
  {
    id: "baseten",
    name: "Baseten",
    protocol: "openai",
    apiUrl: "https://model-<model-id>.api.baseten.co/production/predict",
    apiKeyUrl: "https://app.baseten.co/settings/api_keys",
    docs: "https://docs.baseten.co",
    isLocal: false,
  },
  {
    id: "chutes",
    name: "Chutes",
    protocol: "openai",
    apiUrl: "https://api.chutes.ai/v1",
    apiKeyUrl: "https://chutes.ai/app/keys",
    docs: "https://chutes.ai/docs",
    isLocal: false,
  },
  {
    id: "featherless",
    name: "Featherless AI",
    protocol: "openai",
    apiUrl: "https://api.featherless.ai/v1",
    apiKeyUrl: "https://featherless.ai/dashboard",
    docs: "https://featherless.ai/docs",
    isLocal: false,
  },
  {
    id: "arcee",
    name: "Arcee AI",
    protocol: "openai",
    apiUrl: "https://api.arcee.ai/v2",
    apiKeyUrl: "https://app.arcee.ai/api-keys",
    docs: "https://docs.arcee.ai",
    isLocal: false,
  },
  {
    id: "alibaba",
    name: "Alibaba Model Studio",
    protocol: "openai",
    apiUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    apiKeyUrl: "https://bailian.console.alibabacloud.com",
    docs: "https://www.alibabacloud.com/help/en/model-studio",
    isLocal: false,
  },
  {
    id: "qwen",
    name: "Qwen",
    protocol: "openai",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKeyUrl: "https://dashscope.console.aliyun.com/apiKey",
    docs: "https://help.aliyun.com/document_detail/2712195.html",
    isLocal: false,
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    protocol: "openai",
    apiUrl: "https://api.moonshot.cn/v1",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    docs: "https://platform.moonshot.cn/docs",
    isLocal: false,
  },
  {
    id: "minimax",
    name: "MiniMax",
    protocol: "openai",
    apiUrl: "https://api.minimax.chat/v1",
    apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    docs: "https://platform.minimaxi.com/document/guides",
    isLocal: false,
  },
  {
    id: "stepfun",
    name: "StepFun",
    protocol: "openai",
    apiUrl: "https://api.stepfun.com/v1",
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    docs: "https://platform.stepfun.com/docs",
    isLocal: false,
  },
  {
    id: "qianfan",
    name: "Qianfan",
    protocol: "openai",
    apiUrl: "https://qianfan.baidubce.com/v2",
    apiKeyUrl: "https://console.bce.baidu.com/qianfan/ais/console/onlineService",
    docs: "https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html",
    isLocal: false,
  },
  {
    id: "volcengine",
    name: "Volcengine (Doubao)",
    protocol: "openai",
    apiUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    docs: "https://www.volcengine.com/docs/82379",
    isLocal: false,
  },
  {
    id: "tencent",
    name: "Tencent Cloud (TokenHub / TokenPlan)",
    protocol: "openai",
    apiUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    apiKeyUrl: "https://console.cloud.tencent.com/cam/capi",
    docs: "https://cloud.tencent.com/document/product/1729",
    isLocal: false,
  },
  {
    id: "zai",
    "name": "Z.AI",
    protocol: "openai",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    docs: "https://open.bigmodel.cn/dev/api",
    isLocal: false,
  },
  {
    id: "xiaomi",
    name: "Xiaomi MiMo",
    protocol: "openai",
    apiUrl: "https://api.mimo.xiaomi.com/v1",
    apiKeyUrl: "https://platform.mimo.xiaomi.com/docs",
    docs: "https://platform.mimo.xiaomi.com/docs",
    isLocal: false,
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    protocol: "openai",
    apiUrl: "https://bedrock-runtime.{region}.amazonaws.com",
    apiKeyUrl: "https://console.aws.amazon.com/iam",
    docs: "https://docs.aws.amazon.com/bedrock/latest/userguide",
    isLocal: false,
  },
  {
    id: "bedrock-mantle",
    name: "Amazon Bedrock Mantle",
    protocol: "openai",
    apiUrl: "https://bedrock-mantle.{region}.amazonaws.com/v1",
    apiKeyUrl: "https://console.aws.amazon.com/iam",
    docs: "https://docs.aws.amazon.com/bedrock",
    isLocal: false,
  },
  {
    id: "anthropic-vertex",
    name: "Anthropic Vertex",
    protocol: "anthropic",
    apiUrl: "https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/anthropic/models",
    apiKeyUrl: "https://console.cloud.google.com/apis/credentials",
    docs: "https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude",
    isLocal: false,
  },
  {
    id: "huggingface",
    name: "Hugging Face (inference)",
    protocol: "openai",
    apiUrl: "https://api-inference.huggingface.co/models",
    apiKeyUrl: "https://huggingface.co/settings/tokens",
    docs: "https://huggingface.co/docs/api-inference",
    isLocal: false,
  },
  {
    id: "venice",
    name: "Venice AI",
    protocol: "openai",
    apiUrl: "https://api.venice.ai/api/v1",
    apiKeyUrl: "https://venice.ai/settings/api",
    docs: "https://docs.venice.ai",
    isLocal: false,
  },
  {
    id: "telnyx",
    name: "Telnyx",
    protocol: "openai",
    apiUrl: "https://api.telnyx.com/v2/ai",
    apiKeyUrl: "https://portal.telnyx.com/#/app/api-keys",
    docs: "https://developers.telnyx.com/docs/inference",
    isLocal: false,
  },
  {
    id: "gmicloud",
    name: "GMI Cloud",
    protocol: "openai",
    apiUrl: "https://api.gmicloud.ai/v1",
    apiKeyUrl: "https://console.gmicloud.ai",
    docs: "https://docs.gmicloud.ai",
    isLocal: false,
  },
  {
    id: "longcat",
    name: "LongCat",
    protocol: "openai",
    apiUrl: "https://api.longcat.chat/v1",
    apiKeyUrl: "https://longcat.chat/developer",
    docs: "https://longcat.chat/docs",
    isLocal: false,
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    protocol: "openai",
    apiUrl: "https://cloud.ollama.ai/v1",
    apiKeyUrl: "https://cloud.ollama.ai/settings/keys",
    docs: "https://docs.ollama.ai",
    isLocal: false,
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    protocol: "openai",
    apiUrl: "https://api.githubcopilot.com",
    apiKeyUrl: "https://github.com/settings/tokens",
    docs: "https://docs.github.com/en/copilot",
    isLocal: false,
  },
  {
    id: "opencode",
    name: "OpenCode",
    protocol: "openai",
    apiUrl: "https://api.opencode.ai/v1",
    apiKeyUrl: "https://opencode.ai/settings",
    docs: "https://docs.opencode.ai",
    isLocal: false,
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    protocol: "openai",
    apiUrl: "https://go.opencode.ai/v1",
    apiKeyUrl: "https://opencode.ai/settings",
    docs: "https://docs.opencode.ai",
    isLocal: false,
  },
  {
    id: "synthetic",
    name: "Synthetic",
    protocol: "openai",
    apiUrl: "https://api.synthetic.ai/v1",
    apiKeyUrl: "https://synthetic.ai/dashboard",
    docs: "https://docs.synthetic.ai",
    isLocal: false,
  },
  {
    id: "radius",
    name: "Radius",
    protocol: "openai",
    apiUrl: "https://api.radius.ai/v1",
    apiKeyUrl: "https://radius.ai/developer",
    docs: "https://docs.radius.ai",
    isLocal: false,
  },
  {
    id: "cloudflare",
    name: "Cloudflare AI gateway",
    protocol: "openai",
    apiUrl: "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}",
    apiKeyUrl: "https://dash.cloudflare.com",
    docs: "https://developers.cloudflare.com/ai-gateway/",
    isLocal: false,
  },
  {
    id: "kilogateway",
    name: "Kilo Gateway",
    protocol: "openai",
    apiUrl: "https://api.kilogateway.com/v1",
    apiKeyUrl: "https://kilogateway.com/dashboard",
    docs: "https://docs.kilogateway.com",
    isLocal: false,
  },
  {
    id: "litellm",
    name: "LiteLLM",
    protocol: "openai",
    apiUrl: "http://localhost:4000/v1",
    apiKeyUrl: "http://localhost:4000",
    docs: "https://docs.litellm.ai",
    isLocal: true,
  },
  {
    id: "vercel",
    name: "Vercel AI gateway",
    protocol: "openai",
    apiUrl: "https://gateway.ai.vercel.store/v1",
    apiKeyUrl: "https://vercel.com/dashboard",
    docs: "https://vercel.com/docs/ai",
    isLocal: false,
  },
  {
    id: "clawrouter",
    name: "ClawRouter",
    protocol: "openai",
    apiUrl: "https://router.openclaw.ai/v1",
    apiKeyUrl: "https://openclaw.ai/settings/keys",
    docs: "https://docs.openclaw.ai/gateway",
    isLocal: false,
  },
  {
    id: "claude-max-proxy",
    name: "Claude Max API proxy",
    protocol: "anthropic",
    apiUrl: "http://localhost:8080/v1",
    apiKeyUrl: "N/A (Local / Self-configured proxy)",
    docs: "https://docs.openclaw.ai/providers",
    isLocal: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    protocol: "openai",
    apiUrl: "http://localhost:11434/v1",
    apiKeyUrl: "N/A (Local / Self-hosted)",
    docs: "https://github.com/ollama/ollama/blob/main/docs/api.md",
    isLocal: true,
  },
  {
    id: "vllm",
    name: "vLLM",
    protocol: "openai",
    apiUrl: "http://localhost:8000/v1",
    apiKeyUrl: "N/A (Local / Self-hosted)",
    docs: "https://docs.vllm.ai/",
    isLocal: true,
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    protocol: "openai",
    apiUrl: "http://localhost:1234/v1",
    apiKeyUrl: "N/A (Local / Self-hosted)",
    docs: "https://lmstudio.ai/docs",
    isLocal: true,
  },
  {
    id: "sglang",
    name: "SGLang",
    protocol: "openai",
    apiUrl: "http://localhost:30000/v1",
    apiKeyUrl: "N/A (Local / Self-hosted)",
    docs: "https://sgl-project.github.io/",
    isLocal: true,
  },
  {
    id: "ds4llmman",
    name: "ds4llmman",
    protocol: "openai",
    apiUrl: "http://localhost:8080/v1",
    apiKeyUrl: "N/A (Local / Self-hosted)",
    docs: "https://docs.openclaw.ai/providers",
    isLocal: true,
  },
  {
    id: "azure-speech",
    name: "Azure Speech",
    protocol: "custom",
    apiUrl: "https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
    apiKeyUrl: "https://portal.azure.com",
    docs: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service",
    isLocal: false,
  },
  {
    id: "deepgram",
    name: "Deepgram",
    protocol: "custom",
    apiUrl: "https://api.deepgram.com/v1",
    apiKeyUrl: "https://console.deepgram.com",
    docs: "https://developers.deepgram.com",
    isLocal: false,
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    protocol: "custom",
    apiUrl: "https://api.elevenlabs.io/v1",
    apiKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
    docs: "https://elevenlabs.io/docs",
    isLocal: false,
  },
  {
    id: "fish-audio",
    name: "Fish Audio",
    protocol: "custom",
    apiUrl: "https://api.fish.audio/v1",
    apiKeyUrl: "https://fish.audio/app/api-keys",
    docs: "https://docs.fish.audio",
    isLocal: false,
  },
  {
    id: "gradium",
    name: "Gradium",
    protocol: "custom",
    apiUrl: "https://api.gradium.ai/v1",
    apiKeyUrl: "https://gradium.ai/dashboard",
    docs: "https://docs.gradium.ai",
    isLocal: false,
  },
  {
    id: "inworld",
    name: "Inworld",
    protocol: "custom",
    apiUrl: "https://api.inworld.ai/v1",
    apiKeyUrl: "https://studio.inworld.ai",
    docs: "https://docs.inworld.ai",
    isLocal: false,
  },
  {
    id: "senseaudio",
    name: "SenseAudio",
    protocol: "custom",
    apiUrl: "https://api.senseaudio.ai/v1",
    apiKeyUrl: "https://senseaudio.ai/console",
    docs: "https://docs.senseaudio.ai",
    isLocal: false,
  },
  {
    id: "comfyui",
    name: "ComfyUI",
    protocol: "custom",
    apiUrl: "http://127.0.0.1:8188",
    apiKeyUrl: "N/A (Local / Self-hosted)",
    docs: "https://github.com/comfyanonymous/ComfyUI",
    isLocal: true,
  },
  {
    id: "fal",
    name: "Fal",
    protocol: "custom",
    apiUrl: "https://fal.run",
    apiKeyUrl: "https://fal.ai/dashboard/keys",
    docs: "https://fal.ai/docs",
    isLocal: false,
  },
  {
    id: "kie",
    name: "Kie AI",
    protocol: "openai",
    apiUrl: "https://api.kie.ai/v1",
    apiKeyUrl: "https://kie.ai/dashboard",
    docs: "https://docs.kie.ai",
    isLocal: false,
  },
  {
    id: "pixverse",
    name: "PixVerse",
    protocol: "custom",
    apiUrl: "https://api.pixverse.ai/v1",
    apiKeyUrl: "https://platform.pixverse.ai",
    docs: "https://docs.pixverse.ai",
    isLocal: false,
  },
  {
    id: "runway",
    name: "Runway",
    protocol: "custom",
    apiUrl: "https://api.runwayml.com/v1",
    apiKeyUrl: "https://app.runwayml.com/settings/api-keys",
    docs: "https://docs.runwayml.com",
    isLocal: false,
  },
  {
    id: "vydra",
    name: "Vydra",
    protocol: "openai",
    apiUrl: "https://api.vydra.ai/v1",
    apiKeyUrl: "https://vydra.ai/settings",
    docs: "https://docs.vydra.ai",
    isLocal: false,
  },
];

/**
 * Looks up catalog item by ID or name (case-insensitive).
 */
export function findCatalogProvider(identifier?: string): ProviderCatalogItem | undefined {
  if (!identifier) return undefined;
  const lower = identifier.toLowerCase().trim();
  return PROVIDER_CATALOG.find(
    (item) => item.id.toLowerCase() === lower || item.name.toLowerCase() === lower
  );
}

/**
 * Parsed namespaced model identifier: <provider_id>/<model_id>
 */
export interface ParsedNamespacedModel {
  providerId: string;
  modelId: string;
  isNamespaced: boolean;
}

/**
 * Parses namespaced model strings (<provider_id>/<model_id>) by splitting strictly
 * on the first forward slash ('/').
 * If no slash is present, resolves providerId via defaultProvider or falls back to 'openai'.
 *
 * Examples:
 * - "openai/gpt-4o" -> { providerId: "openai", modelId: "gpt-4o", isNamespaced: true }
 * - "nvidia/meta/llama-3.3-70b-instruct" -> { providerId: "nvidia", modelId: "meta/llama-3.3-70b-instruct", isNamespaced: true }
 * - "claude-3-7-sonnet" -> { providerId: "anthropic", modelId: "claude-3-7-sonnet", isNamespaced: false }
 */
export function parseNamespacedModel(
  rawModel: string,
  defaultProvider?: string
): ParsedNamespacedModel {
  const trimmed = (rawModel || "").trim();
  const firstSlashIndex = trimmed.indexOf("/");

  if (firstSlashIndex > 0) {
    const providerId = trimmed.slice(0, firstSlashIndex).toLowerCase();
    const modelId = trimmed.slice(firstSlashIndex + 1);
    return {
      providerId,
      modelId,
      isNamespaced: true,
    };
  }

  // Fallback for non-namespaced model strings
  let inferredProvider = (defaultProvider || "openai").toLowerCase();
  if (trimmed.startsWith("claude")) {
    inferredProvider = "anthropic";
  } else if (
    trimmed.startsWith("gpt") ||
    trimmed.startsWith("o1") ||
    trimmed.startsWith("o3") ||
    trimmed.startsWith("text-embedding")
  ) {
    inferredProvider = "openai";
  } else if (
    trimmed.includes("llama") ||
    trimmed.includes("deepseek") ||
    trimmed.includes("qwen")
  ) {
    inferredProvider = defaultProvider || "openai";
  }

  return {
    providerId: inferredProvider,
    modelId: trimmed,
    isNamespaced: false,
  };
}

/**
 * Formats a provider ID and model ID into canonical namespaced format: <provider_id>/<model_id>
 */
export function formatNamespacedModel(providerId: string, modelId: string): string {
  const cleanProvider = providerId.trim().toLowerCase();
  const cleanModel = modelId.trim();
  if (cleanModel.startsWith(`${cleanProvider}/`)) {
    return cleanModel;
  }
  return `${cleanProvider}/${cleanModel}`;
}

/**
 * Structured provider configuration schema for persistence and runtime resolution.
 */
export const ProviderConfigSchema = z.object({
  id: z.string().min(1, "Provider ID is required"),
  name: z.string().optional(),
  protocol: ProviderProtocolSchema.default("openai"),
  baseUrl: z.string().min(1, "Base URL is required"),
  credential: ModelCredentialSchema.optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string(), z.string()).default({}),
  isLocal: z.boolean().default(false),
  models: z.array(z.string()).default([]),
  fallbackChain: z.array(z.string()).default([]),
  updatedAt: z.number().int().nonnegative().default(() => Date.now()),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Inference streaming request envelope dispatched across native IPC/bridge.
 */
export const InferenceStreamRequestSchema = z.object({
  model: z.string().min(1, "Namespaced model identifier (<provider>/<model>) is required"),
  prompt: z.string().optional(),
  messages: z.array(z.record(z.string(), z.unknown())).default([]),
  systemPrompt: z.string().optional(),
  tools: z.array(z.record(z.string(), z.unknown())).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stopSequences: z.array(z.string()).optional(),
  stream: z.boolean().default(true),
  timeoutMs: z.number().int().positive().default(60_000),
});
export type InferenceStreamRequest = z.infer<typeof InferenceStreamRequestSchema>;
