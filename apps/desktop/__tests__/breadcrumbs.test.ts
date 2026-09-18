import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Issue #3: Interactive Codex-Style Workspace & Session Breadcrumb Popovers", () => {
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const dashboardPath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")
  const useAgentSessionPath = path.resolve(__dirname, "../src/hooks/useAgentSession.ts")
  const windowRustPath = path.resolve(__dirname, "../src-tauri/src/commands/window.rs")
  const libRustPath = path.resolve(__dirname, "../src-tauri/src/lib.rs")

  it("1. Breadcrumbs Click Isolation & Cursor Styling: ensures drag suppression and interactive styling", () => {
    expect(fs.existsSync(windowHeaderPath)).toBe(true)
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Breadcrumbs container has no-drag region
    expect(headerSource).toContain("Middle Segment: Breadcrumbs (Click-Isolated)")
    expect(headerSource).toContain('data-tauri-drag-region="false"')
    expect(headerSource).toContain('WebkitAppRegion: "no-drag"')

    // Workspace segment button has no-drag and cursor pointer
    expect(headerSource).toContain("1. Left Segment: Workspace Switcher Popover")
    expect(headerSource).toContain('cursor: "pointer"')
    expect(headerSource).toContain("cursor-pointer")

    // Session segment button has no-drag and cursor pointer
    expect(headerSource).toContain("2. Right Segment: Session Switcher Popover")
  })

  it("2. Workspace Switcher Popover: displays recent workspaces, active indicator, Open Folder, and New Project", () => {
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Popover trigger and dropdown container
    expect(headerSource).toContain("isWorkspaceMenuOpen")
    expect(headerSource).toContain("setIsWorkspaceMenuOpen")
    expect(headerSource).toContain("workspaceMenuRef")

    // Active workspace indicator
    expect(headerSource).toContain("Check className")
    expect(headerSource).toContain("bg-violet-950/40 text-violet-200")

    // Actions in Workspace popover
    expect(headerSource).toContain("Open Folder...")
    expect(headerSource).toContain("handleOpenFolder")
    expect(headerSource).toContain("New Project...")
    expect(headerSource).toContain("Ctrl+Shift+N")

    // Zero state when no workspaces exist
    expect(headerSource).toContain("No Workspaces Found")
    expect(headerSource).toContain("Create or open a folder to get started.")

    // New project modal
    expect(headerSource).toContain("CREATE WORKSPACE PROJECT MODAL")
    expect(headerSource).toContain("isNewProjectModalOpen")
    expect(headerSource).toContain("newProjectName")
    expect(headerSource).toContain("handleCreateProjectSubmit")
  })

  it("3. Session Switcher Popover: displays search filter, recent sessions, active indicator, and New Session", () => {
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Session popover state
    expect(headerSource).toContain("isSessionMenuOpen")
    expect(headerSource).toContain("setIsSessionMenuOpen")
    expect(headerSource).toContain("sessionMenuRef")

    // Search filter input
    expect(headerSource).toContain('placeholder="Search sessions..."')
    expect(headerSource).toContain("sessionSearchQuery")
    expect(headerSource).toContain("setSessionSearchQuery")
    expect(headerSource).toContain("filteredSessions")

    // Active session indicator
    expect(headerSource).toContain("bg-cyan-950/40 text-cyan-200")

    // + New Session action
    expect(headerSource).toContain("New Session")
    expect(headerSource).toContain("Ctrl+N")
    expect(headerSource).toContain("onNewChat()")

    // Zero state when no sessions exist or filter has no matches
    expect(headerSource).toContain("No Sessions Found")
    expect(headerSource).toContain("No sessions matching")
  })

  it("4. Dismissal & Keyboard Navigation: handles outside clicks and Escape key", () => {
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Outside click handling
    expect(headerSource).toContain("workspaceMenuRef.current")
    expect(headerSource).toContain("sessionMenuRef.current")
    expect(headerSource).toContain("setIsWorkspaceMenuOpen(false)")
    expect(headerSource).toContain("setIsSessionMenuOpen(false)")

    // Escape key dismissal
    expect(headerSource).toContain('e.key === "Escape"')
    expect(headerSource).toContain("handleKeyDown")
    expect(headerSource).toContain('window.addEventListener("keydown", handleKeyDown)')
  })

  it("5. useAgentSession Hook: implements openFolder and seamless project switching", () => {
    expect(fs.existsSync(useAgentSessionPath)).toBe(true)
    const hookSource = fs.readFileSync(useAgentSessionPath, "utf-8")

    // openFolder implementation
    expect(hookSource).toContain("const openFolder = useCallback")
    expect(hookSource).toContain('invoke<string | null>("open_folder_dialog")')
    expect(hookSource).toContain("showDirectoryPicker")
    expect(hookSource).toContain("selectProject(existing.id)")
    expect(hookSource).toContain("createProject(folderName, selectedPath)")
    expect(hookSource).toContain("openFolder,")
  })

  it("6. Dashboard Integration: wires workspace and session props to WindowHeader", () => {
    expect(fs.existsSync(dashboardPath)).toBe(true)
    const dashSource = fs.readFileSync(dashboardPath, "utf-8")

    expect(dashSource).toContain("projects={session.projects}")
    expect(dashSource).toContain("activeProjectId={session.activeProjectId}")
    expect(dashSource).toContain("onSelectProject={session.selectProject}")
    expect(dashSource).toContain("onOpenFolder={session.openFolder}")
    expect(dashSource).toContain("threads={session.activeProject?.threads}")
    expect(dashSource).toContain("activeThreadId={session.activeThreadId}")
    expect(dashSource).toContain("onSelectThread={session.selectThread}")
  })

  it("7. Native Tauri IPC: registers open_folder_dialog command", () => {
    expect(fs.existsSync(windowRustPath)).toBe(true)
    const rustSource = fs.readFileSync(windowRustPath, "utf-8")
    expect(rustSource).toContain("pub async fn open_folder_dialog")

    expect(fs.existsSync(libRustPath)).toBe(true)
    const libSource = fs.readFileSync(libRustPath, "utf-8")
    expect(libSource).toContain("open_folder_dialog,")
  })
})
