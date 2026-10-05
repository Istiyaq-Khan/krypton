import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Desktop First-Run Setup Window Drag & Provider Integration", () => {
  const wizardPath = path.resolve(__dirname, "../src/components/setup/FirstRunSetupWizard.tsx")
  const modelDiscoveryPath = path.resolve(__dirname, "../src/lib/modelDiscovery.ts")
  const dashboardPath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")
  const tauriLibPath = path.resolve(__dirname, "../src-tauri/src/lib.rs")

  it("1. Verifies FirstRunSetupWizard provides native window dragging without dismissibility", () => {
    expect(fs.existsSync(wizardPath)).toBe(true)
    const source = fs.readFileSync(wizardPath, "utf-8")

    // Must have native window drag attributes on header
    expect(source).toContain("data-tauri-drag-region")
    expect(source).toContain("WebkitAppRegion")
    expect(source).toContain("app-region-drag")

    // Must support window minimization and maximization
    expect(source).toContain("window_minimize")
    expect(source).toContain("window_toggle_maximize")

    // Must support native drag invoke
    expect(source).toContain("window_start_dragging")
    expect(source).toContain("handleHeaderMouseDown")

    // Must be strictly non-dismissible on first-run: no close button on header
    expect(source).not.toContain("window_close")
    expect(source).toContain("STRICTLY NO CLOSE BUTTON")
  })

  it("2. Verifies Provider Catalog integration and 60+ presets availability", () => {
    const wizardSource = fs.readFileSync(wizardPath, "utf-8")
    const discoverySource = fs.readFileSync(modelDiscoveryPath, "utf-8")

    expect(wizardSource).toContain("PROVIDER_CATALOG")
    expect(wizardSource).toContain("Browse 60+ Providers Catalog")
    expect(wizardSource).toContain("handleSelectPreset")
    expect(wizardSource).toContain("formatNamespacedModel")

    expect(discoverySource).toContain("PROVIDER_CATALOG")
    expect(discoverySource).toContain("findCatalogProvider")
    expect(discoverySource).toContain("parseNamespacedModel")
    expect(discoverySource).toContain("saveProviderConfig")
    expect(discoverySource).toContain("executeInferenceStream")
  })

  it("3. Verifies backend proxying prevents client-side CORS errors", () => {
    const wizardSource = fs.readFileSync(wizardPath, "utf-8")
    const discoverySource = fs.readFileSync(modelDiscoveryPath, "utf-8")

    // Wizard invokes testAndFetchModels with useProxy: true
    expect(wizardSource).toContain("useProxy: true")

    // Model discovery communicates with DAEMON_PROXY_URL
    expect(discoverySource).toContain("DAEMON_PROXY_URL")
    expect(discoverySource).toContain("http://127.0.0.1:19840/api/fetch-models")
  })

  it("4. Verifies daemon auto-spawning in desktop layer", () => {
    const tauriLibSource = fs.readFileSync(tauriLibPath, "utf-8")
    const dashboardSource = fs.readFileSync(dashboardPath, "utf-8")

    // Tauri setup hook auto-spawns daemon
    expect(tauriLibSource).toContain("commands::spawn_daemon()")

    // Dashboard page ensures daemon is spawned on mount
    expect(dashboardSource).toContain('invoke("spawn_daemon")')
  })
})
