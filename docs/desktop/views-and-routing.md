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
│   └── page.tsx              # Main Workstation Shell (Sidebar, Stream, Chatbar, Drawers)
└── overlay/
    └── page.tsx              # Standalone Voice Micro-HUD window route
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

### C. Voice Micro-HUD Route (`/overlay`)
Dedicated route loaded inside the secondary transparent Tauri window:
- Self-contained, lightweight UI displaying a live microphone waveform visualizer.
- Target agent selector chip (`[Orchestrator]`, `[CoderBot]`).
- Real-time transcription preview text with instant submission trigger.

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
- **Scroll Optimization**: Clean, styled scrollbars adhering to system color schemes.
