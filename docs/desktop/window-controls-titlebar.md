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
3. **Application Menus**: `File`, `Edit`, `View`, `Settings`, and `Help` dropdown menus with native-style keyboard shortcuts (`Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+B`, `Ctrl+J`, `Ctrl+,`).
4. **Breadcrumbs & Workspace Switcher Popover**: Active workspace folder and conversation thread breadcrumb pill with chevron toggle. Clicking the breadcrumb exclusively toggles the drag-isolated Workspace Switcher popover, allowing instant workspace activation with active checkmark indication and "+ New Workspace..." creation without mutating the workspace list.
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
- **Application Menus Order**: `File`, `Edit`, `View`, `Settings`, and `Help` (with `Settings` positioned directly before `Help`).
- **Settings Menu**: Provides direct shortcuts to full-screen Krypton Settings (`Preferences... Ctrl+,` or `Cmd+,` on macOS) and specific category navigation (`General`, `Agents & Identity`, `Model Providers`, `Appearance`).
- **Preferences Access**: Direct menu shortcuts to open the Krypton Settings interface or First-Run Setup Wizard.
- **Chronological History**: `Back` and `Forward` buttons allowing users to navigate between visited project workspaces, settings, and chat threads.

---

## 5. Breadcrumb Workspace Switcher Popover

The middle segment breadcrumb (`<projectName> / <threadTitle>`) serves as a clickable gateway to switch workspaces:
- **Click Behavior**: Clicking the breadcrumb exclusively toggles the `isWorkspaceSwitcherOpen` state. It carries **zero side effects** on the workspace collection and never triggers workspace creation.
- **Popover Contents**:
  - Displays the total number of configured workspaces.
  - Lists each workspace with its folder icon, workspace name, normalized filesystem path, and total conversation thread count.
  - Marks the currently active workspace with a distinctive purple border, background highlight, and checkmark icon (`Check`).
  - Contains a `+ New Workspace...` action button that opens the workspace creation modal.
- **Click-to-Activate**: Clicking any workspace from the popover invokes `onSelectProject(proj.id)` and immediately closes the popover.
- **Dismissal Controls**: Closes gracefully upon outside mouse clicks, selecting a project, opening another header menu, or pressing the `Escape` key.
- **Drag Isolation**: Nested within an explicit `data-tauri-drag-region="false"` container with CSS `app-region-no-drag` and `pointer-events-auto`, ensuring clicks and scrolls inside the popover are never captured by window drag handlers.

