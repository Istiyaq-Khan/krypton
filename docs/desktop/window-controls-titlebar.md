# Window Controls & Frameless Titlebar

This document covers the unified frameless window architecture, native window controls, draggable window regions, and titlebar menus in the **Krypton** desktop application.

---

## 1. Unified Frameless Architecture

Krypton suppresses standard operating system window decorations across Windows, macOS, and Linux to provide an ultra-sleek, modern interface without dual titlebars:

```json
// apps/desktop/src-tauri/tauri.conf.json
{
  "label": "main",
  "title": "Krypton",
  "decorations": false,
  "resizable": true,
  "fullscreen": false
}
```

By suppressing OS borders, Krypton hosts an in-app titlebar header (`WindowHeader.tsx`) that behaves as a native window header while incorporating navigation, project selection, workspace controls, quick actions, and window controls.

---

## 2. Draggable Regions & Event Isolation

To ensure smooth window movement while preventing interactive controls from being blocked by drag listeners, Krypton combines Tauri's native `data-tauri-drag-region` with standard CSS `-webkit-app-region`:

### A. Draggable Header Spans
- **Header Element**: The root `<header>` container is marked with `data-tauri-drag-region` and `-webkit-app-region: drag` (`app-region-drag`).
- **Empty Header Areas**: Dedicated draggable spacers occupy the empty spaces between menus and breadcrumbs, and between breadcrumbs and window controls. Users can click and drag anywhere in these spans across multi-monitor setups.
- **Double-Click Action**: Double-clicking on any draggable header region toggles between maximized and restored window states.

### B. Interactive Element Click Isolation
Every interactive element in the header is explicitly isolated from window drag handlers using:
```html
<div
  data-tauri-drag-region="false"
  style={{ WebkitAppRegion: "no-drag" }}
  className="pointer-events-auto app-region-no-drag"
>
  <!-- Interactive Element -->
</div>
```

The isolated interactive controls include:
1. **App Logo & Dropdown**: Krypton brand emblem button with quick menu for new sessions, new workspaces, settings, voice HUD, shortcuts, and exit.
2. **Navigation History Buttons**: `Back` (`<`) and `Forward` (`>`) buttons for chronological navigation between projects and sessions.
3. **Application Menus**: `File`, `Edit`, `View`, and `Help` dropdown menus with native-style keyboard shortcuts.
4. **Breadcrumbs Container**: Active workspace folder and conversation thread breadcrumb pill.
5. **Search & Notification Icons**: Quick search (`Ctrl+K`) and notifications (`Bell`) action buttons.
6. **Layout Toggles**: Left sidebar (`PanelLeft`) and right output drawer (`PanelRight`) toggle buttons.
7. **Window Action Buttons**: Native minimize, maximize/restore, and close buttons.

---

## 3. Native Window Action IPC Commands

Window lifecycle operations are handled by Rust Tauri commands defined in `apps/desktop/src-tauri/src/commands/window.rs` and registered in `apps/desktop/src-tauri/src/lib.rs`:

| Action | Rust IPC Command | Description |
| :--- | :--- | :--- |
| **Minimize** | `window_minimize` | Minimizes the active window to the taskbar/dock. |
| **Toggle Maximize** | `window_toggle_maximize` | Toggles between maximized screen and restored geometry, returning next state. |
| **Close** | `window_close` | Initiates graceful application teardown. |
| **Query State** | `window_is_maximized` | Queries whether the window is currently maximized to swap icons (`Square` vs `Copy`). |
| **Open Folder Dialog** | `open_folder_dialog` | Invokes native OS directory selection picker and returns canonical path. |

### Client-Side State Synchronization Pattern
To guarantee that the maximize/restore icon stays synchronized even when windows are snapped, un-snapped, or resized via native OS gestures or double-clicks:

```typescript
import { isTauri, invoke } from "@tauri-apps/api/core"

// 1. Query state on mount
const updateMaximized = async () => {
  if (isTauri()) {
    const isMax = await invoke<boolean>("window_is_maximized")
    setIsMaximized(isMax)
  }
}

// 2. Listen to window resize events (triggered by OS snap/maximize/restore)
window.addEventListener("resize", updateMaximized)

// 3. Native Tauri window resize listener
import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
  getCurrentWindow().onResized(() => updateMaximized())
})

// 4. Manual toggle handler
const handleToggleMaximize = async () => {
  if (isTauri()) {
    const next = await invoke<boolean>("window_toggle_maximize")
    setIsMaximized(next)
  } else {
    setIsMaximized(!isMaximized)
  }
}
```

---

## 4. In-App Titlebar Menus & Navigation History

The header integrates classic application menu bars and browser-style navigation:
- **Application Menus**: `File`, `Edit`, `View`, and `Help` dropdown menus with native-style keyboard shortcuts (`Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+B`, `Ctrl+J`, `Ctrl+,`).
- **Preferences Access**: Direct menu shortcuts to reopen the First-Run Setup Wizard or settings modal.
- **Chronological History**: `Back` and `Forward` buttons allowing users to navigate between visited project workspaces and chat threads.

---

## 5. Interactive Codex-Style Breadcrumb Popovers

The middle header section hosts a dual-segment interactive breadcrumb bar providing instant workspace and conversation context switching without full application reload:

```
[ 📁 my-first-workspace ▾ ] / [ 💬 Initial Session ▾ ]
         │                               │
         ▼                               ▼
  Workspace Switcher              Session Switcher
  - Recent workspaces list        - Real-time search filter input
  - Active check indicator        - Recent conversation threads
  - "Open Folder..." action       - Active check indicator
  - "+ New Project..." modal      - "+ New Session" (Ctrl+N)
```

### A. Click Isolation & Drag Region Rules
- Both segments and their popovers are explicitly wrapped in `data-tauri-drag-region="false"` and `style={{ WebkitAppRegion: "no-drag", cursor: "pointer" }}`.
- Clicking any segment does not trigger window dragging.

### B. Workspace Switcher Popover (Left Segment)
- **Recent Workspaces**: Displays all registered projects with name, filesystem path, and an active indicator (`Check` icon and violet badge).
- **Clean Switching**: Selecting a workspace activates it immediately without reloading the application shell.
- **Open Folder Dialog**: Triggers `open_folder_dialog` (PowerShell on Windows, osascript on macOS, zenity on Linux) with web File System Access API fallbacks. Newly chosen directories are auto-registered and switched to.
- **New Workspace Modal**: Built-in modal dialog allowing the user to create a project by name and path directly from the header.
- **Zero State**: Displays a clean empty state with "+ Add Project" and "Open Folder" actions when no workspaces are loaded.

### C. Session Switcher Popover (Right Segment)
- **Live Search Filter**: Top auto-focused input (`Search sessions...`) filtering conversations in real time with quick-clear button (`X`).
- **Recent Sessions**: Lists conversation threads for the active workspace, complete with message counts and active thread indicators (`Check` icon and cyan badge).
- **New Session**: "+ New Session" action (`Ctrl+N`) immediately creates a clean autonomous thread.
- **Zero States**: Renders dedicated empty states for workspaces with no threads and queries yielding zero search matches.

### D. Dismissal & Outside-Click Handling
- Click events outside open popovers (`mousedown`) dismiss open menus smoothly.
- The `Escape` key closes all active popovers and resets active search filter queries.
