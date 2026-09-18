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
│   └── AudioWaveform.tsx     # Real-time microphone audio amplitude visualizer
├── TodoTree.tsx              # Interactive task DAG tree with real-time status badges
├── QuestionModal.tsx         # Multi-channel HITL clarification dialog
└── VcsDiffViewer.tsx         # Side-by-side Git worktree diff reviewer
```

---

## 2. Key Interactive Components

### A. WindowHeader (`WindowHeader.tsx`)
Frameless window titlebar, menus, and navigation hub:
- **Interactive Codex Breadcrumbs**: Click-isolated dual-segment breadcrumb pill (`-webkit-app-region: no-drag; cursor: pointer;`).
  - **Workspace Switcher Popover**: Lists recent workspaces, active workspace indicator, native "Open Folder..." action (`open_folder_dialog`), and "+ New Project" modal.
  - **Session Switcher Popover**: Auto-focus search input for real-time title filtering, recent session list with active indicators, and "+ New Session" button (`Ctrl+N`).
  - **Zero States & Dismissal**: Dedicated empty states and smooth click-outside / `Escape` dismissal.
- **Titlebar Menus & History**: `File`, `Edit`, `View`, and `Help` dropdown menus with `Back` and `Forward` history traversal.
- **Native Window IPC Controls**: Minimize, maximize/restore, and close buttons synchronized with host OS geometry.

### B. ExecutionStream (`ExecutionStream.tsx`)
The centerpiece of the workstation interface:
- Displays user prompts alongside streaming assistant responses.
- Renders **AgentThoughtTrace** collapsible accordions showing the model's intermediate reflection before taking action.
- Renders **ToolExecutionCard** displaying tool name, arguments, execution duration, and truncated output preview with a button to view full offloaded logs.

### B. Chatbar (`Chatbar.tsx`)
High-performance prompt input engine:
- **Slash Commands (`/`)**: Triggers command menu (`/run`, `/test`, `/diff`, `/rollback`, `/commit`).
- **Context Mentions (`@`)**: Selects target agent (`@Orchestrator`, `@CoderBot`, `@TesterBot`).
- **Pills & Attachments**: Visual chips for attached files, active Git worktree branches, or image screenshots.

### C. TodoTree (`TodoTree.tsx`)
Dynamic Task DAG visualizer:
- Displays topological dependencies between tasks.
- Visual status indicators: `pending` (gray), `in_progress` (animated blue pulse), `completed` (green check), `failed` (red alert).
- Animates real-time DAG re-structuring when the dynamic replanner inserts recovery sub-tasks.

### D. QuestionModal (`QuestionModal.tsx`)
Human-in-the-Loop (HITL) prompt resolution modal:
- Renders structured choices as selectable pills with keyboard shortcuts (`1`, `2`, `3` or Arrow keys).
- Includes an optional freeform text field for detailed instructions.
- Submitting unblocks the waiting agent execution promise across all connected clients.

### E. VcsDiffViewer (`VcsDiffViewer.tsx`)
Visual inspection interface for agent code modifications:
- Side-by-side syntax-highlighted diffs comparing the worktree branch (`krypton/<task-id>`) against the base branch.
- Action triggers: "Approve & Merge", "Rollback Step", or "Reject & Abort".
