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
| **2** | **Model & Providers** | Primary LLM routing (`5.6 Terra High`, `Claude 3.7 Sonnet`, `GPT-4o`, `DeepSeek R1`, `Ollama`), API Keys (Anthropic / OpenAI), Custom Base URL. |
| **3** | **Workspace Path** | Root Project Directory (`%USERPROFILE%\Projects` or `$HOME/projects`), Initial Workspace Name (`krypton-workspace`). |
| **4** | **Guardrails & Privacy**| HITL confirmation requirements, AST Safety Linter enforcement, Telemetry opt-in (disabled by default). |

---

## 3. Native Configuration Persistence (`setup.rs`)

When the wizard is submitted, the Rust backend handles atomic disk writes and encryption:

1. **Directory Provisioning**: Creates the `~/.krypton/` hierarchy (`agents/`, `worktrees/`, `cache/`, `logs/`).
2. **Global Config Generation**: Writes `~/.krypton/config.json` containing `isInitialized: true`, model settings, and default paths.
3. **Secret Encryption**: Encrypts API keys using the machine-specific derivative key and writes them to `~/.krypton/credentials.enc`.
4. **Agent Manifest Initialization**: Scaffolds the default supervisor agent inside `~/.krypton/agents/<agentName>/`:
   - `config.json`: Structured machine configuration and tool permissions.
   - `IDENTITY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`: Pure context markdown files.
5. **Instant State Transition**: Updates the in-memory workstation state, transitioning to `/dashboard` with zero app restart.
