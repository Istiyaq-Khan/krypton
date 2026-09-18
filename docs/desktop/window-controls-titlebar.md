# Window Controls & Frameless Titlebar

This document covers the unified frameless window architecture, native window controls, draggable window regions, and titlebar menus in the **Krypton** desktop application.

---

## 1. Unified Frameless Architecture

Krypton suppresses standard operating system window decorations across Windows, macOS, and Linux to provide an ultra-sleek, modern interface:

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

By suppressing OS borders, Krypton hosts an in-app titlebar header (`WindowHeader.tsx`) that behaves as a native window header while incorporating navigation, project selection, workspace controls, and window actions.

---

## 2. Draggable Regions & Event Isolation

To ensure smooth window movement while preventing interactive controls from being blocked by drag listeners:

- **Draggable Region**: The top header container is marked with `data-tauri-drag-region`, allowing users to drag the window across screens.
- **Click Isolation**: Every button, input, dropdown, menu item, and breadcrumb in the header is explicitly decorated with:
  ```html
  <div data-tauri-drag-region="false" className="pointer-events-auto">
    <!-- Interactive Element -->
  </div>
  ```
  This prevents drag gestures from intercepting button clicks.

---

## 3. Native Window Action IPC Commands

Window lifecycle operations are handled by Rust Tauri commands defined in `apps/desktop/src-tauri/src/commands/window.rs`:

| Action | Rust IPC Command | Description |
| :--- | :--- | :--- |
| **Minimize** | `window_minimize` | Minimizes the active window to the taskbar/dock. |
| **Toggle Maximize** | `window_toggle_maximize` | Toggles between maximized screen and restored geometry. |
| **Close** | `window_close` | Initiates graceful application teardown. |
| **Query State** | `window_is_maximized` | Queries whether the window is currently maximized to swap icons (`Square` vs `Copy`). |

### Client-Side Invocation Pattern
```typescript
import { invoke } from "@tauri-apps/api/core";

// Window control handlers
const handleMinimize = () => invoke("window_minimize");
const handleToggleMaximize = async () => {
  const isMax = await invoke<boolean>("window_toggle_maximize");
  setIsMaximized(isMax);
};
const handleClose = () => invoke("window_close");
```

---

## 4. In-App Titlebar Menus & Navigation History

The header integrates classic application menu bars and browser-style navigation:
- **Application Menus**: `File`, `Edit`, `View`, and `Help` dropdown menus with native-style keyboard shortcuts (`Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+B`, `Ctrl+J`, `Ctrl+,`).
- **Preferences Access**: Direct menu shortcuts to reopen the First-Run Setup Wizard or settings modal.
- **Chronological History**: `Back` and `Forward` buttons allowing users to navigate between visited project workspaces and chat threads.
