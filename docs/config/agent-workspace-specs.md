# Agent Workspace Specifications & Storage Decoupling

This document defines the storage layout, separation of concerns, and migration protocols for autonomous agent workspaces in `~/.krypton/agents/<agentName>/`.

---

## 1. Separation of Concerns: Machine vs. Context

Krypton strictly isolates **machine-readable operational configuration** from **human- and LLM-readable prompt/context documents**:

```
~/.krypton/agents/<agentName>/
├── config.json                # Dedicated machine configuration (JSON, strictly typed)
├── IDENTITY.md                # Persona, creature, vibe, system prompt (pure markdown)
├── SOUL.md                    # Core directives, reasoning style & guardrails
├── AGENTS.md                  # Operational workspace conventions & local notes
├── USER.md                    # Durable user directives & profile facts
├── MEMORY.md                  # Curated long-term distilled knowledge & facts
├── TODO.md                    # Live task DAG ledger & historical log
├── BOOTSTRAP.md               # First-run onboarding ritual (cleared upon init)
└── short_term/                # Append-only transcripts, event store & trajectories
    ├── events.jsonl
    └── trajectories/
```

### Invariant Rules:
1. **`config.json` Is Single Source of Machine Truth**: Model identifiers, temperature, provider routing, token budgets, recursion boundaries (`maxDepth`), and tool manifests are persisted exclusively in `config.json`.
2. **Markdown Files Contain Zero Configuration Keys**: Markdown files (`*.md`) are reserved strictly for instructions, personality, user models, domain knowledge, and execution ledgers. Markdown frontmatter MUST NOT serialize application settings or configuration keys.
3. **Prompt Assembler Isolation**: System prompts are assembled from markdown files as pure text with frontmatter stripped. Machine configuration keys never leak into LLM prompt contexts.
4. **Independent Mutation**: Modifying settings in `config.json` does not rewrite markdown files; updating markdown prompt files does not touch `config.json`.

---

## 2. Machine Configuration Specification (`config.json`)

Validates against `AgentConfigFileSchema` in `@krypton/shared-types`:

```json
{
  "id": "agent-orchestrator",
  "name": "Orchestrator",
  "role": "System Orchestrator & Autonomous Desktop Agent",
  "model": "claude-3-7-sonnet-20250219",
  "provider": "anthropic",
  "temperature": 0.2,
  "contextWindowLimit": 128000,
  "tools": ["terminal", "filesystem", "astLinter", "web"],
  "permissions": {
    "allowedSubAgents": ["CoderBot", "TesterBot"],
    "allowedTools": ["terminal", "filesystem", "astLinter", "web"],
    "maxDepth": 3,
    "maxConcurrentChildren": 5,
    "budgetShare": 0.5,
    "canSynthesizeTools": true,
    "canAccessNetwork": true,
    "canModifyWorkspace": true
  },
  "budget": {
    "total": 100000,
    "used": 0
  },
  "createdAt": 1773826000000,
  "updatedAt": 1773826000000
}
```

---

## 3. Self-Healing & Migration Protocol

If an uninitialized or legacy workspace lacking `config.json` is loaded:
1. `readAgentConfig()` inspects legacy files (`IDENTITY.md`, `AGENTS.md`) for legacy YAML frontmatter.
2. Extracts model, role, temperature, and permissions.
3. Synthesizes a fully compliant `config.json` with safe defaults.
4. Atomically writes `config.json` to disk, completing migration with zero downtime.
