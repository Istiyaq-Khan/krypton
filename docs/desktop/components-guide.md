# Desktop Components & UI State Catalog

This document cataloging the core frontend React components, visual state machines, and interactive widgets in the **Krypton** desktop application.

---

## 1. Core Component Map

```
apps/desktop/src/components/
├── WindowHeader.tsx          # Frameless drag-enabled titlebar, menus, controls
├── layout/
│   ├── ProjectSidebar.tsx    # Project navigator, agent fleet list, daemon status
│   └── OutputsDrawer.tsx     # Tabbed bottom panel (PTY, Diff, Tasks, Logs)
├── stream/
│   ├── ExecutionStream.tsx   # Primary virtualized chronological message & tool stream
│   ├── UserMessageBubble.tsx # User instruction presentation
│   ├── AgentThoughtTrace.tsx # Collapsible accordion displaying agent inner monologue
│   └── ToolExecutionCard.tsx # Visual execution state of tool calls (args, status, stdout)
├── chatbar/
│   ├── Chatbar.tsx           # Multi-line input bar with quick action buttons
│   ├── CommandMenu.tsx       # Autocomplete slash commands (/run, /vcs, /test)
│   ├── CommandContextBar.tsx # Context attachment chips (@agent, #worktree, !file)
│   ├── InlineVoiceRecorder.tsx # 4-stage inline dictation state machine & animated indicator
│   ├── ModelSelectorPopover.tsx # Accessible dark model picker with search & family groups
│   └── AudioWaveform.tsx     # Real-time microphone audio amplitude visualizer
├── ui/
│   └── popover.tsx           # Base UI accessible popover primitives
├── TodoTree.tsx              # Interactive task DAG tree with real-time status badges
├── QuestionModal.tsx         # Multi-channel HITL clarification dialog
└── VcsDiffViewer.tsx         # Side-by-side Git worktree diff reviewer
```

---

## 2. Key Interactive Components

### A. ExecutionStream (`ExecutionStream.tsx`)
The centerpiece of the workstation interface:
- Displays user prompts alongside streaming assistant responses.
- Renders **AgentThoughtTrace** collapsible accordions showing the model's intermediate reflection before taking action.
- Renders **ToolExecutionCard** displaying tool name, arguments, execution duration, and truncated output preview with a button to view full offloaded logs.

### B. Chatbar (`Chatbar.tsx`) & CommandContextBar (`CommandContextBar.tsx`)
High-performance prompt input engine:
- **Slash Commands (`/`)**: Triggers command menu (`/run`, `/test`, `/diff`, `/rollback`, `/commit`).
- **Context Mentions (`@`)**: Selects target agent (`@Orchestrator`, `@CoderBot`, `@TesterBot`).
- **Pills & Attachments**: Visual chips for attached files, active Git worktree branches, or image screenshots.
- **Model Selector**: Powered by `ModelSelectorPopover` for frictionless reasoning engine switching.

### C. ModelSelectorPopover (`ModelSelectorPopover.tsx`)
Accessible dark popover reasoning model switcher:
- **Live Search Filtering**: Real-time multi-field query matching across model IDs, names, descriptions, and provider owners.
- **Family Grouping**: Automatically categorizes models into visual clusters: Anthropic / Claude, OpenAI / Reasoning, DeepSeek, Google / Gemini, Meta / Llama, Local / Ollama, and Custom.
- **Rich Metadata Badges**: Displays context window limits (e.g. `200k`, `128k`, `1M`), provider status, and active selection checkmarks.
- **Custom Dark Scroll Styling**: Integrated 7px neutral scrollbar with overflow isolation.
- **Keyboard Navigation**: Full `Escape`, auto-focus search, and accessible focus outlines.
- **In-App Discovery Refresh**: One-click dynamic model synchronization from provider endpoints.

### D. TodoTree (`TodoTree.tsx`)
Dynamic Task DAG visualizer:
- Displays topological dependencies between tasks.
- Visual status indicators: `pending` (gray), `in_progress` (animated blue pulse), `completed` (green check), `failed` (red alert).
- Animates real-time DAG re-structuring when the dynamic replanner inserts recovery sub-tasks.

### E. QuestionModal (`QuestionModal.tsx`)
Human-in-the-Loop (HITL) prompt resolution modal:
- Renders structured choices as selectable pills with keyboard shortcuts (`1`, `2`, `3` or Arrow keys).
- Includes an optional freeform text field for detailed instructions.
- Submitting unblocks the waiting agent execution promise across all connected clients.

### F. VcsDiffViewer (`VcsDiffViewer.tsx`)
Visual inspection interface for agent code modifications:
- Side-by-side syntax-highlighted diffs comparing the worktree branch (`krypton/<task-id>`) against the base branch.
- Action triggers: "Approve & Merge", "Rollback Step", or "Reject & Abort".

### G. InlineVoiceRecorder (`InlineVoiceRecorder.tsx`)
Real-time chat toolbar speech dictation engine:
- **4-Stage State Machine**: `idle` ➔ `recording` ➔ `transcribing` ➔ `inserted`.
- **Animated Recording Indicator**: Renders reactive 4-bar amplitude visualizer, pulsating red REC badge, and square stop button.
- **Offline Parity**: Transcribes audio locally via Web Audio API and the active offline STT engine (`whisper-tiny-q8_0` GGUF), sharing the exact model cache as Krypton Synapse without triggering the Synapse HUD overlay window.
- **Direct Text Piping**: Streams partial and final recognized text directly into the chat input textarea.

