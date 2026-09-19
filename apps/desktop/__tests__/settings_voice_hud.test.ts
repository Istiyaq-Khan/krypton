import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Issue #4: Codex-Style Settings System & Floating Voice HUD Overlay", () => {
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const codexSettingsPath = path.resolve(__dirname, "../src/components/settings/CodexSettings.tsx")
  const floatingVoiceAgentPath = path.resolve(__dirname, "../src/components/voice/FloatingVoiceAgent.tsx")
  const dashboardPagePath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")
  const settingsPagePath = path.resolve(__dirname, "../src/app/settings/page.tsx")
  const setupRustPath = path.resolve(__dirname, "../src-tauri/src/commands/setup.rs")
  const libRustPath = path.resolve(__dirname, "../src-tauri/src/lib.rs")
  const sharedConfigPath = path.resolve(__dirname, "../../packages/shared-types/src/config.ts")

  it("1. Menu Bar Integration: confirms exact top menu sequence 'File Edit View Settings Help'", () => {
    expect(fs.existsSync(windowHeaderPath)).toBe(true)
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // Verify all 5 menu labels exist in comments and DOM elements
    expect(headerSource).toContain("File Menu")
    expect(headerSource).toContain("Edit Menu")
    expect(headerSource).toContain("View Menu")
    expect(headerSource).toContain("Settings Menu")
    expect(headerSource).toContain("Help Menu")

    // Verify precise sequential ordering: File -> Edit -> View -> Settings -> Help
    const fileIdx = headerSource.indexOf("{/* File Menu */}")
    const editIdx = headerSource.indexOf("{/* Edit Menu */}")
    const viewIdx = headerSource.indexOf("{/* View Menu */}")
    const settingsIdx = headerSource.indexOf("{/* Settings Menu */}")
    const helpIdx = headerSource.indexOf("{/* Help Menu */}")

    expect(fileIdx).toBeGreaterThan(0)
    expect(fileIdx).toBeLessThan(editIdx)
    expect(editIdx).toBeLessThan(viewIdx)
    expect(viewIdx).toBeLessThan(settingsIdx)
    expect(settingsIdx).toBeLessThan(helpIdx)
  })

  it("2. Menu Bar Integration: wires Settings button and Ctrl+, / Cmd+, shortcut navigation", () => {
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    // onOpenSettings prop declared and passed
    expect(headerSource).toContain("onOpenSettings?: (category?: string) => void")
    expect(headerSource).toContain("onOpenSettings,")

    // Global keyboard listener for Ctrl+, / Cmd+,
    expect(headerSource).toContain('e.key === ","')
    expect(headerSource).toContain("onOpenSettings?.()")

    // Settings dropdown buttons wire to onOpenSettings
    expect(headerSource).toContain("onOpenSettings?.()")
    expect(headerSource).toContain('onOpenSettings?.("general")')
    expect(headerSource).toContain('onOpenSettings?.("agents")')
    expect(headerSource).toContain('onOpenSettings?.("providers")')
    expect(headerSource).toContain('onOpenSettings?.("appearance")')
  })

  it("3. Codex Settings Interface: renders Top Navigation with 'Back to app' button", () => {
    expect(fs.existsSync(codexSettingsPath)).toBe(true)
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // Back to app button
    expect(settingsSource).toContain("Back to app")
    expect(settingsSource).toContain("onClick={onBack}")
    expect(settingsSource).toContain("ArrowLeft")
  })

  it("4. Codex Settings Interface: provides Left Navigation Sidebar with 4 required categories", () => {
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // 4 Categories present
    expect(settingsSource).toContain('type SettingsCategory = "general" | "agents" | "providers" | "appearance"')
    expect(settingsSource).toContain('onClick={() => setActiveCategory("general")}')
    expect(settingsSource).toContain('onClick={() => setActiveCategory("agents")}')
    expect(settingsSource).toContain('onClick={() => setActiveCategory("providers")}')
    expect(settingsSource).toContain('onClick={() => setActiveCategory("appearance")}')
  })

  it("5. Codex Settings: General category provides workspace directory, terminal shell, and approval toggles", () => {
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // Default workspace directory
    expect(settingsSource).toContain("Default Workspace Directory")
    expect(settingsSource).toContain("workspaceDir")

    // Default terminal shell
    expect(settingsSource).toContain("Default Terminal Shell")
    expect(settingsSource).toContain("terminalShell")
    expect(settingsSource).toContain("PowerShell")
    expect(settingsSource).toContain("Command Prompt")
    expect(settingsSource).toContain("Git Bash")

    // Ask for approval vs Autonomous execution
    expect(settingsSource).toContain("Ask for Approval")
    expect(settingsSource).toContain("Autonomous Execution")
    expect(settingsSource).toContain("Static AST Security Linter")
    expect(settingsSource).toContain("Anonymous Crash Reporting")
  })

  it("6. Codex Settings: Agents & Identity lists agents, creates new agents, and saves strictly to config.json", () => {
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // Roster and creation
    expect(settingsSource).toContain("Agents & Identity")
    expect(settingsSource).toContain("Create Agent")
    expect(settingsSource).toContain("handleCreateNewAgent")

    // Strict config.json persistence
    expect(settingsSource).toContain("config.json")
    expect(settingsSource).toContain("save_agent_config")
    expect(settingsSource).toContain("handleUpdateAgentField")
  })

  it("7. Codex Settings: Model Providers supports keys, custom base URLs, and test connections", () => {
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // Model provider tabs
    expect(settingsSource).toContain("Model Providers")
    expect(settingsSource).toContain("openai")
    expect(settingsSource).toContain("anthropic")
    expect(settingsSource).toContain("openrouter")
    expect(settingsSource).toContain("ollama")
    expect(settingsSource).toContain("custom")

    // Base URLs and keys
    expect(settingsSource).toContain("providerKeys")
    expect(settingsSource).toContain("providerUrls")
    expect(settingsSource).toContain("Test Connection & Discover Models")
    expect(settingsSource).toContain("handleTestProviderConnection")
    expect(settingsSource).toContain("testAndFetchModels")
  })

  it("8. Codex Settings: Appearance allows immediate theme, font sizing, and UI density changes without restart", () => {
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // Theme, font size, density
    expect(settingsSource).toContain("Dark Obsidian")
    expect(settingsSource).toContain("Midnight Violet")
    expect(settingsSource).toContain("Cyber Slate")
    expect(settingsSource).toContain("OLED Black")

    expect(settingsSource).toContain("Compact")
    expect(settingsSource).toContain("Standard")
    expect(settingsSource).toContain("Comfortable")

    // Immediate DOM mutation
    expect(settingsSource).toContain("document.documentElement.setAttribute")
    expect(settingsSource).toContain("persistAppearanceSettings")
  })

  it("9. Floating Voice HUD Decoupling: elevated with z-[9999], isolated drag events, and persistent across views", () => {
    expect(fs.existsSync(floatingVoiceAgentPath)).toBe(true)
    const voiceSource = fs.readFileSync(floatingVoiceAgentPath, "utf-8")

    // Elevated z-index and isolated pointer events
    expect(voiceSource).toContain("z-[9999]")
    expect(voiceSource).toContain("pointer-events-auto")
    expect(voiceSource).toContain('WebkitAppRegion: "no-drag"')
    expect(voiceSource).toContain('data-tauri-drag-region="false"')

    // Active in both dashboard and settings routes
    const dashboardSource = fs.readFileSync(dashboardPagePath, "utf-8")
    expect(dashboardSource).toContain("<CodexSettings")
    expect(dashboardSource).toContain("<FloatingVoiceAgent")
    expect(dashboardSource).toContain('activeView === "settings"')

    const settingsSource = fs.readFileSync(settingsPagePath, "utf-8")
    expect(settingsSource).toContain("<CodexSettings")
    expect(settingsSource).toContain("<FloatingVoiceAgent")
  })

  it("10. Rust Desktop Backend: registers app settings and agent config commands", () => {
    expect(fs.existsSync(setupRustPath)).toBe(true)
    const rustSetup = fs.readFileSync(setupRustPath, "utf-8")
    expect(rustSetup).toContain("pub fn get_app_settings")
    expect(rustSetup).toContain("pub fn save_app_settings")
    expect(rustSetup).toContain("pub fn save_agent_config")
    expect(rustSetup).toContain("pub fn list_agents_config")

    const rustLib = fs.readFileSync(libRustPath, "utf-8")
    expect(rustLib).toContain("get_app_settings,")
    expect(rustLib).toContain("save_app_settings,")
    expect(rustLib).toContain("save_agent_config,")
    expect(rustLib).toContain("list_agents_config,")
  })
})
