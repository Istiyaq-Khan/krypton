import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Issue #1: Window Chrome Suppression, Drag Regions & Window IPC Controls", () => {
  const tauriConfPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json")
  const windowRustPath = path.resolve(__dirname, "../src-tauri/src/commands/window.rs")
  const libRustPath = path.resolve(__dirname, "../src-tauri/src/lib.rs")
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css")

  it("1. Suppress Native OS Window Chrome: ensures decorations is false for all windows", () => {
    expect(fs.existsSync(tauriConfPath)).toBe(true)
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"))
    const windows = tauriConf.app?.windows

    expect(Array.isArray(windows)).toBe(true)
    const mainWindow = windows.find((w: any) => w.label === "main")
    expect(mainWindow).toBeDefined()
    expect(mainWindow.decorations).toBe(false)

    const overlayWindow = windows.find((w: any) => w.label === "overlay")
    expect(overlayWindow).toBeDefined()
    expect(overlayWindow.decorations).toBe(false)
  })

  it("2. Fix In-App Window Drag Regions: defines CSS drag region utilities and selectors in globals.css", () => {
    expect(fs.existsSync(globalsCssPath)).toBe(true)
    const css = fs.readFileSync(globalsCssPath, "utf-8")

    expect(css).toContain("[data-tauri-drag-region]")
    expect(css).toContain("-webkit-app-region: drag")
    expect(css).toContain('[data-tauri-drag-region="false"]')
    expect(css).toContain("-webkit-app-region: no-drag")
    expect(css).toContain("@utility app-region-drag")
    expect(css).toContain("@utility app-region-no-drag")
  })

  it("3. Fix In-App Window Drag Regions: verifies drag regions on empty header areas", () => {
    expect(fs.existsSync(windowHeaderPath)).toBe(true)
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Main header element has drag attributes
    expect(headerSource).toContain("<header")
    expect(headerSource).toContain("data-tauri-drag-region")
    expect(headerSource).toContain('WebkitAppRegion: "drag"')

    // Empty spaces between menus/breadcrumbs and breadcrumbs/controls have drag attributes
    expect(headerSource).toContain("Empty Draggable Region between Menus and Breadcrumbs")
    expect(headerSource).toContain("Empty Draggable Region between Breadcrumbs and Controls")
    expect(headerSource).toContain("app-region-drag")
  })

  it("4. Fix In-App Window Drag Regions: verifies click isolation on every interactive element", () => {
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // App logo & dropdown
    expect(headerSource).toContain("App Logo & Quick Actions Dropdown")
    expect(headerSource).toContain('title="Krypton Menu"')
    expect(headerSource).toContain('WebkitAppRegion: "no-drag"')

    // Application menus (File, Edit, View, Help)
    expect(headerSource).toContain("File Menu")
    expect(headerSource).toContain("Edit Menu")
    expect(headerSource).toContain("View Menu")
    expect(headerSource).toContain("Help Menu")

    // Navigation buttons (< and >)
    expect(headerSource).toContain('title="Back"')
    expect(headerSource).toContain('title="Forward"')

    // Breadcrumbs container
    expect(headerSource).toContain("Middle Segment: Breadcrumbs (Click-Isolated)")
    expect(headerSource).toContain('data-tauri-drag-region="false"')

    // Search and notification icons
    expect(headerSource).toContain('title="Search (Ctrl+K)"')
    expect(headerSource).toContain('title="Notifications"')

    // Window action buttons (Minimize, Maximize/Restore, Close)
    expect(headerSource).toContain('title="Minimize"')
    expect(headerSource).toContain('title="Close"')
    expect(headerSource).toContain('title={isMaximized ? "Restore" : "Maximize"}')

    // Every interactive group has pointer-events-auto and no-drag
    expect(headerSource).toContain("pointer-events-auto")
    expect(headerSource).toContain("app-region-no-drag")
  })

  it("5. Wire Window Controls via Desktop IPC: verifies Tauri Rust commands and registration", () => {
    expect(fs.existsSync(windowRustPath)).toBe(true)
    const rustSource = fs.readFileSync(windowRustPath, "utf-8")

    expect(rustSource).toContain("pub fn window_minimize")
    expect(rustSource).toContain("pub fn window_toggle_maximize")
    expect(rustSource).toContain("pub fn window_close")
    expect(rustSource).toContain("pub fn window_is_maximized")

    expect(fs.existsSync(libRustPath)).toBe(true)
    const libSource = fs.readFileSync(libRustPath, "utf-8")
    expect(libSource).toContain("window_minimize,")
    expect(libSource).toContain("window_toggle_maximize,")
    expect(libSource).toContain("window_close,")
    expect(libSource).toContain("window_is_maximized,")
  })

  it("6. Wire Window Controls via Desktop IPC: verifies frontend IPC wiring and state listeners", () => {
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Native IPC invocations
    expect(headerSource).toContain('invoke("window_minimize")')
    expect(headerSource).toContain('invoke<boolean>("window_toggle_maximize")')
    expect(headerSource).toContain('invoke("window_close")')
    expect(headerSource).toContain('invoke<boolean>("window_is_maximized")')

    // State listener on window resize and Tauri onResized
    expect(headerSource).toContain('window.addEventListener("resize", updateMaximized)')
    expect(headerSource).toContain('getCurrentWindow()')
    expect(headerSource).toContain('.onResized(')

    // Maximize icon toggles based on state
    expect(headerSource).toContain('isMaximized ? <Copy className="size-2.5" /> : <Square className="size-2.5" />')

    // Double-click on header to toggle maximize
    expect(headerSource).toContain("onDoubleClick={handleHeaderDoubleClick}")
  })
})
