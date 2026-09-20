# Views, Routing & Design System

This document outlines the Next.js 16 app directory layout, view routing, workspace state management, and design system tokens in the **Krypton** desktop application.

---

## 1. App Router Directory Structure

The desktop frontend is powered by Next.js 16 (React 19) located at `apps/desktop/src/app/`:

```
apps/desktop/src/app/
├── globals.css               # Core design tokens, theme variables, glassmorphic styles
├── layout.tsx                # Root HTML/Body wrapper, font imports, dark-mode root
├── page.tsx                  # Root route: redirects directly to /dashboard
├── dashboard/
│   └── page.tsx              # Main Workstation Shell (Sidebar, Stream, Chatbar, Drawers) & Settings view switcher
├── settings/
│   └── page.tsx              # Standalone Krypton Settings view route
├── synapse/
│   └── page.tsx              # Standalone Krypton Synapse window route
└── overlay/
    └── page.tsx              # Backward-compatible redirect to /synapse
```

---

## 2. Route Descriptions

### A. Root Route (`/`)
Serves as an immediate client redirect:
```typescript
import { redirect } from "next/navigation";
export default function HomePage() {
  redirect("/dashboard");
}
```

### B. Dashboard Workstation Route (`/dashboard`)
The primary interactive workstation window:
- Hosts the collapsible **ProjectSidebar** (`Ctrl+B`).
- Renders the main **ExecutionStream** containing agent thought traces, user messages, and tool cards.
- Hosts the interactive **Chatbar** with command menus (`/run`, `/test`, `@agent`).
- Toggles the side and bottom drawers: **TodoTree** (`Ctrl+J`), **VcsDiffViewer**, and **OutputsDrawer**.
- Supports seamless in-shell switching between the active project workspace and the **KryptonSettings** view (`Ctrl+,` or `Cmd+,`).
- Seamlessly triggers the top-level **Krypton Synapse** window (`toggle_synapse`) or mounts in-DOM `<KryptonSynapse />` in browser preview mode.

### C. Settings Route (`/settings`)
Dedicated full-screen Krypton settings interface:
- **Top Navigation**: "Back to app" button returning directly to the active workstation.
- **Left Navigation Sidebar**: 4 modular categories:
  - `General`: Default workspace directory, default terminal shell, approval mode ("Ask for approval" vs autonomous execution), AST safety enforcement, telemetry.
  - `Agents & Identity`: Agent fleet roster, new agent workspace creation, and individual agent configuration saving strictly to `<agentDir>/config.json`.
  - `Model Providers`: Provider API keys (OpenAI, Anthropic, OpenRouter, Ollama, Custom), custom endpoints, and dynamic connection testing with discovered models caching.
  - `Appearance`: Theme selector (Dark Obsidian, Midnight Violet, Cyber Slate, OLED Black), font sizing (Compact, Standard, Comfortable), and UI density controls.

### D. Krypton Synapse Route (`/synapse` & `/overlay`)
Dedicated route loaded inside the secondary frameless, transparent Tauri window:
- Self-contained, lightweight UI displaying the interactive Krypton Synapse pill (`data-synapse-window="true"`).
- Live microphone waveform visualizer driven by offline Web Audio API PCM streaming.
- Target agent selector chip (`[Orchestrator]`, `[CoderBot]`).
- Real-time offline speech transcription preview text with instant submission trigger.
- `/overlay` is preserved as a transparent backward-compatible alias route.

---

## 3. Design System & Theming Tokens

Krypton uses a dark-first aesthetic with curated CSS custom properties defined in `apps/desktop/src/app/globals.css`:

```css
:root {
  --background: #090a0f;
  --surface-1: #11131a;
  --surface-2: #181b24;
  --surface-3: #222634;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-accent: rgba(99, 102, 241, 0.3);
  --accent-primary: #6366f1; /* Indigo */
  --accent-secondary: #06b6d4; /* Cyan */
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
}
```

### Key UI Features:
- **Glassmorphism**: Translucent panels with `backdrop-filter: blur(16px)` and subtle glowing borders.
- **Micro-Animations**: Smooth transitions on drawer toggles, agent thought accordions, and live streaming tokens.
- **Scroll Optimization & Global Dark Scrollbars**:
  - **Standard CSS**: Global `scrollbar-width: thin` and `scrollbar-color: rgba(255, 255, 255, 0.16) transparent` applied across all elements in `globals.css`.
  - **WebKit Rules**: Consistent 7px width/height, transparent tracks, rounded thumbs (`border-radius: 9999px`) with `rgba(255, 255, 255, 0.16)` base, `0.28` hover, and `0.38` active drag feedback.
  - **Container Utilities**: `.custom-scrollbar` for designated scroll areas (e.g. popovers, drawers, code blocks) and `.no-scrollbar` for deliberate suppression.
  - **Dual Scrollbar Prevention**: Strict `overflow-x-hidden` on vertical streams and popovers to prevent layout thrashing or horizontal artifacts.

---

## 4. Workspace State Management & Idempotency

Krypton manages project workspaces through `useAgentSession` in the desktop client and persists workstation state into `localStorage` (`krypton_workstation_state_v2`) via `persistence.ts`:

### A. Idempotent Workspace Creation & Activation
- **Strict Uniqueness**: Workspaces are keyed off unique identifiers (`proj-<timestamp>-<hash>`) and normalized filesystem paths.
- **Switch Rather Than Re-Insert**: Invoking `createProject(name, path)` or selecting an existing workspace checks against existing entries using `normalizeWorkspacePath`. If an existing workspace matches, it switches active focus to that workspace and its active thread rather than prepending or duplicating entries.
- **Race Prevention**: Functional updaters in state setters atomically re-verify against concurrent invocations before appending new workspaces.

### B. Filesystem Path Normalization (`normalizeWorkspacePath`)
Deterministic path equality comparison accounts for cross-platform differences:
- Converts backslashes (`\`) to forward slashes (`/`).
- Normalizes Windows drive letters to lowercase (`C:` -> `c:`).
- Collapses redundant consecutive slashes and strips leading `./`.
- Trims trailing slashes while preserving root directories.

### C. Hydration Sanitizer (`sanitizeWorkspaces`)
When loading persisted state on application mount, `loadWorkstationState()` executes `sanitizeWorkspaces`:
- **Deduplication**: Eliminates duplicate workspace entries sharing identical IDs or normalized filesystem paths.
- **Thread Preservation**: Merges conversation threads across duplicate records to ensure no user session history is dropped.
- **Pointer Validation**: Verifies that `activeProjectId` and `activeThreadId` target valid entities, automatically healing orphaned pointers and saving back sanitized state.

