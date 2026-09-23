# First-Run Setup Engine & Onboarding

This document details the automated first-run detection lifecycle, the four-step setup wizard, and native configuration persistence in **Krypton**.

---

## 1. First-Run Detection Flow

When Krypton boots, it verifies whether the host system has been initialized before displaying the primary workstation:

```
                  ┌───────────────────────────────┐
                  │    Application Launches       │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ Invoke `check_setup_status`   │
                  │ (Rust Tauri Command)          │
                  └──────────────┬────────────────┘
                                 │
                 Is `~/.krypton/config.json` present
                 AND contains `isInitialized: true`?
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                YES                              NO
                 │                               │
                 ▼                               ▼
    ┌─────────────────────────┐     ┌─────────────────────────┐
    │ Transition Directly to  │     │ Display Setup Wizard    │
    │ Workstation Dashboard   │     │ (FirstRunSetupWizard)   │
    └─────────────────────────┘     └────────────┬────────────┘
                                                 │
                                     User completes 4 steps &
                                     submits configuration
                                                 │
                                                 ▼
                                    ┌─────────────────────────┐
                                    │ Invoke                  │
                                    │ save_setup_configuration│
                                    └────────────┬────────────┘
                                                 │
                                                 ▼
                                    ┌─────────────────────────┐
                                    │ Seed workspace folders, │
                                    │ write config, transition│
                                    │ to dashboard            │
                                    └─────────────────────────┘
```

---

## 2. Setup Wizard Steps (`FirstRunSetupWizard.tsx`)

The onboarding modal guides the user through four essential configuration stages:

| Step | Section | Configured Properties |
| :--- | :--- | :--- |
| **1** | **Agent Identity** | Supervisor Name (`Orchestrator`), Role description, Persona/Directive template, Reasoning Style (Analytical / Agile / Research). |
| **2** | **Model & Providers** | Simplified Two-Protocol Selection (OpenAI-Compatible & Anthropic-Compatible), Custom Base URL & API Key Inputs, Backend Daemon Server-Side Discovery Proxy (`/api/fetch-models`), Dynamic Model Discovery & Credential Validation, Primary Reasoning Model Selection, Local Cache Generation. |
| **3** | **Workspace Path** | Root Project Directory (`%USERPROFILE%\Projects` or `$HOME/projects`), Initial Workspace Name (`krypton-workspace`). |
| **4** | **Guardrails, Voice & Privacy**| HITL confirmation requirements, AST Safety Linter enforcement, Voice-To-Text (VTT) Engine Selection & Speech Configuration (Whisper Local, Whisper API, NVIDIA Parakeet v3, Custom Endpoint), Telemetry opt-in (disabled by default). |

---

## 3. Two-Protocol Provider Architecture & Server-Side Discovery Proxy

Step 2 implements a streamlined two-provider protocol architecture paired with a backend daemon proxy to eliminate renderer CORS limitations:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 2A: Protocol Selection Cards                           │
│ [ OpenAI-Compatible ]             [ Anthropic-Compatible ]   │
│ (OpenAI, NVIDIA NIM, vLLM,        (Claude 3.7 Sonnet, Haiku,│
│  Ollama, OpenRouter, Groq)         Anthropic gateways)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2B: Base URL & Credential Inputs                       │
│ - Base URL (e.g. https://integrate.api.nvidia.com/v1)       │
│ - API Key / Bearer Token (with show/hide visibility toggle) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2C: Server-Side Model Discovery Proxy                  │
│ Renderer dispatches to Node daemon (`POST /api/fetch-models`│
│ or JSON-RPC `api:fetch-models`) to bypass browser CORS;     │
│ Node runtime resolves TLS, DNS & upstream HTTP headers      │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
         [SUCCESS]                        [FAILURE]
               │                              │
               ▼                              ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│ Step 2D: Primary Model Select││ Descriptive Error Banner    │
│ Dynamically populated from   ││ (401 Auth, 403 Forbidden,   │
│ discovered endpoint roster   ││  404 Route, 429 Quota,      │
│ Cached to models_cache.json  ││  500-504, ECONNREFUSED/Time)│
└──────────────────────────────┘└─────────────────────────────┘
```

### Server-Side Proxy Architecture (`model-proxy.ts` & `daemon.ts`)

Because desktop webviews and browser renderers enforce Cross-Origin Resource Sharing (CORS), client-side queries to external endpoints lacking browser CORS headers (such as NVIDIA NIM at `https://integrate.api.nvidia.com/v1`, vLLM instances, or self-hosted LLMs) fail with generic `Failed to fetch` or `Network/CORS error` messages.

Krypton resolves this by proxying discovery through the background Node.js daemon sidecar (`krypton-daemon` on `http://127.0.0.1:19840`):
1. **Renderer Dispatch**: Setup wizard sends discovery parameters to `POST /api/fetch-models` or JSON-RPC method `api:fetch-models`. The daemon HTTP server provides full CORS support (`Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type, Authorization, Accept, X-Requested-With, Origin, anthropic-version`) and answers `OPTIONS` preflight queries with `204 No Content`.
2. **Node Native Fetch**: Daemon executes native `fetch` with 10-second `AbortSignal` timeout, system TLS trust stores, and protocol-specific authorization headers (`Authorization: Bearer <key>` for OpenAI-compatible/NVIDIA NIM, `x-api-key: <key>` for Anthropic).
3. **Automatic Base URL Sanitization (`sanitizeBaseUrl`)**: Automatically cleans user-provided URLs:
   - Strips pasted chat completions subpaths (e.g. `https://integrate.api.nvidia.com/v1/chat/completions` -> `https://integrate.api.nvidia.com/v1`).
   - Trims trailing slashes (e.g. `https://integrate.api.nvidia.com/v1/` -> `https://integrate.api.nvidia.com/v1`).
   - Normalizes local ports (e.g. `http://localhost:11434/v1` -> `http://localhost:11434/v1`).
   - Appends `/models` cleanly for model roster discovery (`GET <baseUrl>/models`) without path duplication, and later appends `/chat/completions` cleanly for inference.
4. **Status Code Translation**: Maps upstream HTTP errors into structured, user-friendly diagnostic banners (401 Authentication, 403 Forbidden, 404 Route Not Found, 429 Rate Limit / Quota Exceeded, 500–504 Server Error, or ECONNREFUSED).

### Provider Protocol Contracts & Concrete Examples

| Provider | Protocol / Target Endpoint | Concrete Base URL Example | Authentication |
| :--- | :--- | :--- | :--- |
| **NVIDIA NIM** | OpenAI-Compatible (`GET <baseUrl>/models`, `POST <baseUrl>/chat/completions`) | `https://integrate.api.nvidia.com/v1` | `Authorization: Bearer nvapi-...` |
| **OpenAI** | OpenAI-Compatible (`GET <baseUrl>/models`, `POST <baseUrl>/chat/completions`) | `https://api.openai.com/v1` | `Authorization: Bearer sk-proj-...` |
| **Ollama** | Local OpenAI-Compatible (`GET <baseUrl>/models` or `/api/tags`) | `http://localhost:11434/v1` or `http://localhost:11434` | Optional / none required |
| **OpenRouter** | OpenAI-Compatible Gateway (`GET <baseUrl>/models`) | `https://openrouter.ai/api/v1` | `Authorization: Bearer sk-or-v1-...` |
| **Anthropic** | Anthropic-Compatible (`GET <baseUrl>/models`, `POST <baseUrl>/messages`) | `https://api.anthropic.com/v1` | `x-api-key: sk-ant-api03-...`<br/>`anthropic-version: 2023-06-01` |

---

## 4. Native Configuration Persistence (`setup.rs`)

When the wizard is submitted, the Rust backend handles atomic disk writes without hardcoding:

1. **Directory Provisioning**: Creates the `~/.krypton/` hierarchy (`agents/`, `worktrees/`, `cache/`, `logs/`).
2. **Global Config Generation**: Writes `~/.krypton/config.json` containing:
   - `isInitialized: true`
   - Default routing (`defaultRoutes.orchestrator.provider`, `model`)
   - Voice-To-Text (`vtt.engine`, `vtt.architecture`, optional `vtt.customEndpoint`, `vtt.apiKey`)
   - Default workspace paths and telemetry preferences.
3. **Secret Storage**: Saves provider API keys and base URLs into `~/.krypton/credentials.json` (and encrypted vault) mapped cleanly to the active provider.
4. **Model Cache Generation**: Saves discovered models array to `~/.krypton/models_cache.json` with timestamp and endpoint metadata.
5. **Agent Manifest Initialization**: Scaffolds the default supervisor agent inside `~/.krypton/agents/<agentName>/`:
   - `config.json`: Structured machine configuration referencing the chosen `provider` and `model`.
   - `IDENTITY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`: Pure context markdown files.
6. **Instant State Transition**: Updates workstation session state, transitioning directly to `/dashboard`.

---

## 5. Voice-To-Text (VTT) Engine Architecture Configuration

In Step 4, users select their preferred speech transcription engine. Krypton distinguishes underlying computational architectures for execution:

| Engine Option | Engine ID | Runtime Architecture | Execution Profile |
| :--- | :--- | :--- | :--- |
| **Whisper Local** | `whisper_local` | `encoder_decoder_autoregressive` | Zero-latency local inference via 80-channel log-Mel spectrogram and autoregressive Transformer decoder. Completely private, offline. |
| **Whisper API** | `whisper_api` | `cloud_api` | High-accuracy OpenAI Whisper cloud API endpoint via HTTP multipart audio upload. |
| **NVIDIA Parakeet v3** | `nvidia/parakeet-tdt-0.6b-v3` | `conformer_rnnt_tdt` | Ultra-fast Fast Conformer streaming transducer (RNN-T / Token-and-Duration Transducer) optimized for zero-wait speech transcription. |
| **Custom Endpoint** | `custom` | `custom` | User-defined OpenAI-compatible `/v1/audio/transcriptions` or custom websocket/HTTP STT server with customizable endpoint and optional bearer token. |

---

## 6. In-App Model Switcher & Refresh Control

In the main application command bar (`CommandContextBar.tsx`):
- The model dropdown is populated from the local model cache (`~/.krypton/models_cache.json`).
- A **Refresh Models** button (`RotateCw`) embedded in the model selector prompts the user for confirmation before dispatching a network query to the active provider endpoint.
- Upon user confirmation, `refreshModels()` fetches updated models, refreshes `~/.krypton/models_cache.json`, updates in-memory dropdown options, and provides real-time status feedback.

