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
| **2** | **Model & Providers** | Sequential Provider Selection (OpenAI, Anthropic, Ollama / Local Runtime, OpenRouter, Custom OpenAI-Compatible Base URL), Isolated Credential Inputs, Dynamic Model Discovery & Credential Validation, Primary Reasoning Model Selection, Local Cache Generation. |
| **3** | **Workspace Path** | Root Project Directory (`%USERPROFILE%\Projects` or `$HOME/projects`), Initial Workspace Name (`krypton-workspace`). |
| **4** | **Guardrails, Voice & Privacy**| HITL confirmation requirements, AST Safety Linter enforcement, Voice-To-Text (VTT) Engine Selection & Speech Configuration (Whisper Local, Whisper API, NVIDIA Parakeet v3, Custom Endpoint), Telemetry opt-in (disabled by default). |

---

## 3. Sequential Provider Selection & Dynamic Model Discovery Protocol

Step 2 implements a sequential, validated onboarding flow to prevent configuration errors:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 2A: Provider Selection Cards                           │
│ [ OpenAI ] [ Anthropic ] [ Ollama ] [ OpenRouter ] [ Custom]│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2B: Provider-Specific Credential Inputs                │
│ (Renders ONLY inputs required for the selected provider)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2C: Dynamic Model Discovery ("Test & Fetch Models")     │
│ Queries endpoint with 10s timeout & validates credentials   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
         [SUCCESS]                        [FAILURE]
               │                              │
               ▼                              ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│ Step 2D: Primary Model Select││ Descriptive Error Banner    │
│ Populated dynamically from   ││ (401 Auth, 403 Forbidden,   │
│ discovered endpoint roster   ││  404 Not Found, 429 Quota,  │
│ Cached to models_cache.json  ││  ECONNREFUSED / Timeout)    │
└──────────────────────────────┘└─────────────────────────────┘
```

### Provider Endpoint Contracts

| Provider | Endpoint | Required Inputs | Headers & Auth |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `GET https://api.openai.com/v1/models` | `apiKey` | `Authorization: Bearer <key>` |
| **Anthropic** | `GET https://api.anthropic.com/v1/models` | `apiKey` | `x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access` |
| **Ollama** | `GET <baseUrl>/v1/models` (fallback: `/api/tags`) | `baseUrl` (default: `http://localhost:11434`) | Optional Bearer token |
| **OpenRouter**| `GET https://openrouter.ai/api/v1/models` | `apiKey`, `baseUrl` | `Authorization: Bearer <key>`, `HTTP-Referer`, `X-Title` |
| **Custom** | `GET <baseUrl>/models` or `/v1/models` | `baseUrl`, optional `apiKey` | Optional Bearer token |

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

