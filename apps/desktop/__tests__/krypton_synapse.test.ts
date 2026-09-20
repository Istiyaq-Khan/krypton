import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Krypton Synapse: Rebranding, Single Transparent Window & Offline Audio Pipeline", () => {
  const synapseComponentPath = path.resolve(__dirname, "../src/components/voice/KryptonSynapse.tsx")
  const floatingVoiceAgentPath = path.resolve(__dirname, "../src/components/voice/FloatingVoiceAgent.tsx")
  const useSynapseHookPath = path.resolve(__dirname, "../src/hooks/useSynapse.ts")
  const useVoiceHudHookPath = path.resolve(__dirname, "../src/hooks/useVoiceHud.ts")
  const audioPipelinePath = path.resolve(__dirname, "../src/lib/synapse/audioPipeline.ts")
  const synapsePagePath = path.resolve(__dirname, "../src/app/synapse/page.tsx")
  const overlayPagePath = path.resolve(__dirname, "../src/app/overlay/page.tsx")
  const dashboardPagePath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const tauriConfPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json")
  const overlayRustPath = path.resolve(__dirname, "../src-tauri/src/overlay.rs")
  const pathsRustPath = path.resolve(__dirname, "../src-tauri/src/paths.rs")
  const globalsCssPath = path.resolve(__dirname, "../src/app/globals.css")

  it("1. Component Architecture: KryptonSynapse declares z-[9999], drag regions, and transparent window data attribute", () => {
    expect(fs.existsSync(synapseComponentPath)).toBe(true)
    const source = fs.readFileSync(synapseComponentPath, "utf-8")

    expect(source).toContain("z-[9999]")
    expect(source).toContain('data-synapse-window="true"')
    expect(source).toContain('WebkitAppRegion: "drag"')
    expect(source).toContain('data-tauri-drag-region="true"')
    expect(source).toContain("handleOrbClick")
    expect(source).toContain("clickCountRef.current += 1")
    expect(source).toContain("setIsOrbOnlyMode")
    expect(source).toContain("setIsDismissing(true)")
  })

  it("2. Single Window Invariant: dashboard destroys duplicate in-DOM mounting in Tauri desktop mode", () => {
    expect(fs.existsSync(dashboardPagePath)).toBe(true)
    const dashboardSource = fs.readFileSync(dashboardPagePath, "utf-8")

    // In Tauri, toggle_synapse is invoked
    expect(dashboardSource).toContain("toggleVoiceHud = useCallback")
    expect(dashboardSource).toContain("toggle_synapse")

    // DOM pill is only rendered when not in Tauri desktop mode
    expect(dashboardSource).toContain("!isTauri() && isVoiceAgentVisible &&")
    expect(dashboardSource).toContain("<FloatingVoiceAgent")
  })

  it("3. Transparent Window Styling: globals.css guarantees transparent background for Synapse window", () => {
    expect(fs.existsSync(globalsCssPath)).toBe(true)
    const css = fs.readFileSync(globalsCssPath, "utf-8")

    expect(css).toContain('data-synapse-window="true"')
    expect(css).toContain("background: transparent !important")
  })

  it("4. Offline Audio Capture Pipeline: Web Audio API buffers PCM locally and bypasses Web Speech cloud API", () => {
    expect(fs.existsSync(audioPipelinePath)).toBe(true)
    const audioSource = fs.readFileSync(audioPipelinePath, "utf-8")

    // Uses local AudioContext & ScriptProcessor PCM buffering
    expect(audioSource).toContain("AudioContext")
    expect(audioSource).toContain("createScriptProcessor")
    expect(audioSource).toContain("broadcast_synapse_transcription")

    // Strictly does NOT use cloud webkitSpeechRecognition
    expect(audioSource).not.toContain("webkitSpeechRecognition")
    expect(audioSource).not.toContain("SpeechRecognition")
  })

  it("5. Rebranded Window Configuration: tauri.conf.json defines 'synapse' window with title 'Krypton Synapse'", () => {
    expect(fs.existsSync(tauriConfPath)).toBe(true)
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf-8"))

    const synapseWin = tauriConf.app?.windows?.find((w: any) => w.label === "synapse" || w.label === "overlay")
    expect(synapseWin).toBeDefined()
    expect(synapseWin.title).toBe("Krypton Synapse")
    expect(synapseWin.transparent).toBe(true)
    expect(synapseWin.decorations).toBe(false)
    expect(synapseWin.alwaysOnTop).toBe(true)
  })

  it("6. Rust Backend: overlay.rs and paths.rs support synapse commands and ~/.krypton/models directory", () => {
    expect(fs.existsSync(overlayRustPath)).toBe(true)
    const overlayRust = fs.readFileSync(overlayRustPath, "utf-8")
    expect(overlayRust).toContain("pub fn toggle_synapse")
    expect(overlayRust).toContain("pub fn show_synapse")
    expect(overlayRust).toContain("pub fn hide_synapse")
    expect(overlayRust).toContain('app.emit("synapse:toggle"')

    expect(fs.existsSync(pathsRustPath)).toBe(true)
    const pathsRust = fs.readFileSync(pathsRustPath, "utf-8")
    expect(pathsRust).toContain('"models"')
    expect(pathsRust).toContain("pub models: String")
  })

  it("7. UI Rebranding: WindowHeader menu items reference 'Toggle Krypton Synapse'", () => {
    expect(fs.existsSync(windowHeaderPath)).toBe(true)
    const headerSource = fs.readFileSync(windowHeaderPath, "utf-8")

    expect(headerSource).toContain("Toggle Krypton Synapse")
    expect(headerSource).toContain("Ctrl+Shift+Space")
  })

  it("8. Backwards Compatibility: FloatingVoiceAgent and useVoiceHud seamlessly forward to Synapse equivalents", () => {
    expect(fs.existsSync(floatingVoiceAgentPath)).toBe(true)
    const fvaSource = fs.readFileSync(floatingVoiceAgentPath, "utf-8")
    expect(fvaSource).toContain("KryptonSynapse")
    expect(fvaSource).toContain("export const FloatingVoiceAgent = KryptonSynapse")

    expect(fs.existsSync(useVoiceHudHookPath)).toBe(true)
    const uvhSource = fs.readFileSync(useVoiceHudHookPath, "utf-8")
    expect(uvhSource).toContain("useSynapse")
  })
})
