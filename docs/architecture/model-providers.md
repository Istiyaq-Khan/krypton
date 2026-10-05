# Model Provider Subsystem & Namespaced Routing Architecture

The **Model Provider Subsystem** in Krypton decouples the autonomous agent runtime from third-party LLM API idiosyncrasies, enforces namespaced model identification (`<provider_id>/<model_id>`), eliminates browser-level CORS restrictions via native backend delegates, and delivers resilient multi-model fallback chains.

---

## 1. Architectural Principles

```
┌────────────────────────────────────────────────────────┐
│             Autonomous Agent Execution Loop             │
│        (Agnostic to model endpoints & API nuances)     │
└───────────────────────────┬────────────────────────────┘
                            │ Standard Agent Messages & Tools
                            ▼
┌────────────────────────────────────────────────────────┐
│             Provider Registry & Fallback Chain         │
│          Resolves <provider_id>/<model_id>             │
└───────┬───────────────────┬───────────────────┬────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    OpenAI    │    │  Anthropic   │    │ Local/Custom │
│   Adapter    │    │   Adapter    │    │   Adapter    │
└───────┬──────┘    └───────┬──────┘    └───────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
         Native Backend Delegate (Daemon Proxy)
         - Zero Renderer CORS Overhead
         - AES-256 Vault / Env Var Credential Resolution
         - Server-Sent Events (SSE) Streaming
```

1. **Decoupled Agent Runtime**: The agent planning and execution loops operate strictly on standard message formats, tool definitions, and token streams, completely unaware of provider-specific payloads.
2. **Namespaced Model Identification**: All models throughout the system are addressed via `<provider_id>/<model_id>`. The provider subsystem splits exclusively on the first forward slash (`/`).
3. **Pure Backend Proxying**: The renderer and webview NEVER perform direct third-party HTTP requests. All endpoint probing, model listing, credential validation, and inference execute in the native backend service (`krypton-daemon`).
4. **Resilient Fallback Chains**: Transients such as 429 rate limits, 5xx server errors, or upstream network disruptions seamlessly fail over to alternative configured models without crashing the active task.

---

## 2. Namespaced Model Identification (`<provider_id>/<model_id>`)

All agent routes, configuration files, and API calls require namespaced model strings:

```typescript
import { parseNamespacedModel, formatNamespacedModel } from "@krypton/shared-types"

// Splits strictly on the first forward slash
const { providerId, modelId } = parseNamespacedModel("nvidia/meta/llama-3.1-70b-instruct")
// providerId === "nvidia"
// modelId === "meta/llama-3.1-70b-instruct"

const formatted = formatNamespacedModel("anthropic", "claude-3-7-sonnet-20250219")
// formatted === "anthropic/claude-3-7-sonnet-20250219"
```

- When resolving a model, the segment before the first forward slash determines the registered provider adapter and credentials.
- The segment after the first slash is passed intact to the upstream endpoint, correctly preserving subpaths for multi-tenant gateways (e.g. `meta/llama-3.1-70b-instruct` on NVIDIA NIM or OpenRouter).

---

## 3. Protocol Adapters

Krypton ships with modular adapters handling distinct LLM protocols:

| Adapter | Supported Services | Capabilities |
| :--- | :--- | :--- |
| **OpenAI-Compatible** | OpenAI, NVIDIA NIM, Groq, Together, DeepSeek, OpenRouter, Mistral, Cerebras, vLLM, etc. | Chat completions (`/chat/completions`), JSON Schema tool calling, SSE streaming deltas (`data: {...}`), custom base URLs, Bearer authorization. |
| **Anthropic-Compatible** | Anthropic API, Claude proxies, Vertex AI / Bedrock Claude endpoints | Messages API (`/v1/messages`), system prompts, structured content blocks (`text`, `tool_use`, `tool_result`), `anthropic-version: 2023-06-01`. |
| **Local & Custom** | Ollama, LM Studio, LocalAI, vLLM, private GPU clusters | Zero-auth or optional Bearer tokens, dynamic `/v1/models` and `/api/tags` autodetection, offline execution. |

Each adapter implements the `ProtocolAdapter` interface:
```typescript
export interface ProtocolAdapter {
  readonly protocol: ProviderProtocol
  generate(options: GenerateOptions, config: ResolvedProviderConfig): Promise<GenerateResult>
  generateStream(options: GenerateOptions, config: ResolvedProviderConfig): AsyncIterable<GenerateChunk>
  testConnection(config: ResolvedProviderConfig): Promise<{ success: boolean; models: DiscoveredModel[]; error?: string }>
}
```

---

## 4. 64-Provider Catalog & Preset Autodetection

A pre-configured catalog of 64 AI model providers is maintained in `packages/shared-types/src/providers/provider-catalog.json` and mirrored in typed constants:

- **Top Cloud Providers**: OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, NVIDIA NIM, Together AI, Mistral AI, Cohere, xAI, Perplexity.
- **Inference Accelerators**: Cerebras, Sambanova, Fireworks AI, Lepton AI, OctoAI, Anyscale, Hyperbolic.
- **Local & Self-Hosted**: Ollama, vLLM, LM Studio, LocalAI, Text-Gen-WebUI.
- **Multi-Model Gateways**: OpenRouter, Portkey, Helicone, Cloudflare AI Gateway.

Selecting any provider in the desktop setup wizard or settings automatically populates the standard endpoint URL, documentation link, and API key portal URL.

---

## 5. Native Backend Proxying & IPC Bridge

To prevent renderer/webview CORS blocks and safeguard secrets, the desktop frontend delegates all network operations to the native backend runtime:

```typescript
// IPC / HTTP Endpoint in krypton-daemon
POST /api/fetch-models
POST /api/test-and-fetch-models
POST /api/save-provider-config
POST /api/execute-inference-stream
```

### JSON-RPC 2.0 Daemon WebSocket Actions
- `api:testAndFetchModels`: Connects upstream via Node.js native TLS, probes models list, and returns typed `DiscoveredModel[]`.
- `api:saveProviderConfig`: Writes verified configuration to `~/.krypton/config.json` and credentials to the encrypted vault.
- `api:executeInferenceStream`: Streams token chunks directly to the UI without exposing raw API keys to browser memory.

---

## 6. Type Safety & Credential Storage

Credentials support three strictly discriminated variants:

```typescript
export type ModelCredential =
  | { type: "plain_text"; token: string }
  | { type: "env_var"; envVar: string }
  | { type: "vault"; keyId: string }
```

1. **Plain Text**: Direct tokens entered during setup or testing.
2. **Environment Variable**: `env:OPENAI_API_KEY` or `$NVIDIA_API_KEY` read directly from host process environment.
3. **Encrypted Vault**: `vault:openai_key` retrieved via native AES-256-GCM encrypted vault in `~/.krypton/credentials.json`.

---

## 7. Model Fallback Chains & Resilience

When instantiating the runtime execution engine, a fallback chain can be configured:

```typescript
const provider = new FallbackProvider(registry, [
  "openai/gpt-4o",
  "groq/llama-3.3-70b-versatile",
  "anthropic/claude-3-5-haiku"
])

// If openai/gpt-4o encounters a 429 quota exhaustion or 503 outage,
// FallbackProvider transparently routes the query to groq/llama-3.3-70b-versatile.
const result = await provider.generate({ messages })
```

---

## 8. Verification & Test Coverage

- **Shared Types**: `packages/shared-types/__tests__/providers.test.ts` (14 unit tests).
- **Runtime Adapters & Fallback**: `packages/agent-runtime/__tests__/model_providers.test.ts` (13 integration tests).
- **Model Proxy & CORS Elimination**: `packages/agent-runtime/__tests__/model_proxy.test.ts` (20 tests).
- **Desktop Setup & Window Dragging**: `apps/desktop/__tests__/setup_window_drag.test.ts` (4 integration tests) and `apps/desktop/__tests__/model_discovery.test.ts` (25 tests).
