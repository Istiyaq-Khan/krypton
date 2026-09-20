import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Phase 5: Desktop App Shell & Krypton Synapse Smoke Tests", () => {
  const tauriConfPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json")
  const defaultCapabilityPath = path.resolve(__dirname, "../src-tauri/capabilities/default.json")

  it("tauri.conf.json defines both 'main' dashboard and 'synapse' windows", () => {
    expect(fs.existsSync(tauriConfPath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"))

    const windows = content.app?.windows
    expect(windows).toBeDefined()
    expect(Array.isArray(windows)).toBe(true)
    expect(windows.length).toBeGreaterThanOrEqual(2)

    const mainWindow = windows.find((w: any) => w.label === "main")
    expect(mainWindow).toBeDefined()
    expect(mainWindow.title).toBe("Krypton")
    expect(mainWindow.resizable).toBe(true)
    expect(mainWindow.decorations).toBe(false)

    const overlayWindow = windows.find((w: any) => w.label === "synapse" || w.label === "overlay")
    expect(overlayWindow).toBeDefined()
    expect(overlayWindow.title).toContain("Krypton")
    expect(["/synapse", "/overlay"]).toContain(overlayWindow.url)
    expect(overlayWindow.transparent).toBe(true)
    expect(overlayWindow.decorations).toBe(false)
    expect(overlayWindow.alwaysOnTop).toBe(true)
    expect(overlayWindow.skipTaskbar).toBe(true)
  })

  it("tauri.conf.json declares external sidecar binary for krypton-daemon", () => {
    const content = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"))
    const externalBin = content.bundle?.externalBin
    expect(externalBin).toBeDefined()
    expect(externalBin).toContain("binaries/krypton-daemon")
  })

  it("capabilities/default.json grants permissions to both main and overlay windows", () => {
    expect(fs.existsSync(defaultCapabilityPath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(defaultCapabilityPath, "utf-8"))

    expect(content.windows).toContain("main")
    expect(content.windows.some((w: string) => w === "synapse" || w === "overlay")).toBe(true)
    expect(content.permissions).toContain("core:default")
  })

  it("verifies required frontend component files exist", () => {
    const requiredFiles = [
      "src/components/chatbar/Chatbar.tsx",
      "src/components/chatbar/AttachmentTray.tsx",
      "src/components/chatbar/HoverPreviewCard.tsx",
      "src/components/chatbar/CommandMenu.tsx",
      "src/components/chatbar/AudioWaveform.tsx",
      "src/components/chatbar/InlineVoiceRecorder.tsx",
      "src/components/chatbar/useChatbarState.ts",
      "src/components/TodoTree.tsx",
      "src/components/QuestionModal.tsx",
      "src/components/VcsDiffViewer.tsx",
      "src/hooks/useKryptonDaemon.ts",
      "src/hooks/useVoiceHud.ts",
      "src/app/dashboard/page.tsx",
      "src/app/overlay/page.tsx",
    ]

    for (const rel of requiredFiles) {
      const fullPath = path.resolve(__dirname, "..", rel)
      expect(fs.existsSync(fullPath), `Expected file to exist: ${rel}`).toBe(true)
    }
  })

  it("verifies Rust backend files exist and contain required Tauri commands", () => {
    const rustFiles = [
      "src/paths.rs",
      "src/commands/sidecar.rs",
      "src/commands/hotkey.rs",
      "src/overlay.rs",
      "src/commands/audio.rs",
      "src/lib.rs",
    ]

    for (const rel of rustFiles) {
      const fullPath = path.resolve(__dirname, "../src-tauri", rel)
      expect(fs.existsSync(fullPath), `Expected Rust file: ${rel}`).toBe(true)
    }

    const libRs = fs.readFileSync(path.resolve(__dirname, "../src-tauri/src/lib.rs"), "utf-8")
    expect(libRs).toContain("get_krypton_paths")
    expect(libRs).toContain("spawn_daemon")
    expect(libRs).toContain("toggle_overlay")
    expect(libRs).toContain("submit_chat_turn")
  })
})
