# Human-in-the-Loop (HITL) Interaction Bus

This document details the multi-channel Human-in-the-Loop (HITL) clarification bus, prompt dispatching, and non-blocking response resolution in **Krypton**.

---

## 1. HITL Protocol Architecture

When an autonomous agent encounters ambiguous instructions, missing parameters, or high-risk destructive operations, it pauses execution and dispatches a structured `ClarificationRequest`:

```
┌─────────────────────────────────────────────────────────────┐
│                 Agent Encounters Ambiguity                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Prompt Dispatcher (prompt-bus.ts)               │
│ Broadcasts ClarificationRequest simultaneously across:      │
│  - Desktop UI (QuestionModal Dialog)                        │
│  - CLI Client (Interactive QuestionPrompt TUI)              │
│  - Voice Micro-HUD (Speech Transcription preview)           │
│  - External Messaging Channels (Telegram, Discord, Slack)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            First valid user response received
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Async Input Resolver (resolver.ts)              │
│  - Unblocks the waiting agent execution promise             │
│  - Dismisses/cancels pending prompts on all other channels  │
│  - Injects answer directly into model context               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Clarification Contracts (`interaction.ts`)

Contracts are standardized in `@krypton/shared-types`:

### Request Schema (`ClarificationRequest`)
```typescript
interface ClarificationRequest {
  id: string;                      // Unique UUID
  agentId: string;                 // Querying agent identifier
  prompt: string;                  // Question or decision required
  options: ChoiceOption[];         // Structured choices (pills / buttons)
  allowFreeform: boolean;          // Allow arbitrary user text input
  timeoutMs?: number;              // Optional expiry (default 120,000ms)
}

interface ChoiceOption {
  id: string;                      // Option key (e.g. 'opt-1')
  label: string;                   // Display title (e.g. 'Use Tailwind CSS')
  description?: string;            // Secondary detail
  hotkey?: string;                 // Keyboard shortcut hint ('1', 'T')
}
```

### Response Schema (`ClarificationResponse`)
```typescript
interface ClarificationResponse {
  requestId: string;
  selectedOptionIds: string[];
  freeformText?: string;
  respondingChannel: "desktop_ui" | "cli" | "voice_hud" | "telegram" | "discord" | "slack";
  timestamp: number;
}
```

---

## 3. Non-Blocking Cross-Channel Resolution

1. **Simultaneous Dispatch**: The prompt bus emits the request over WebSocket (desktop/overlay), named pipe (CLI), and active bot sockets.
2. **First-Answer-Wins Policy**: Whichever channel the user responds on first resolves the execution promise immediately.
3. **Prompt Cancellation**: The resolver emits a cancellation packet to other channels, automatically closing modals on the desktop and updating bot message status.
