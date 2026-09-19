import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

describe("Issue #6: Floating Interactive Pill Voice HUD & VTT Onboarding", () => {
  const floatingVoiceAgentPath = path.resolve(__dirname, "../src/components/voice/FloatingVoiceAgent.tsx")
  const firstRunWizardPath = path.resolve(__dirname, "../src/components/setup/FirstRunSetupWizard.tsx")
  const codexSettingsPath = path.resolve(__dirname, "../src/components/settings/CodexSettings.tsx")
  const dashboardPagePath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")
  const overlayPagePath = path.resolve(__dirname, "../src/app/overlay/page.tsx")
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const setupRustPath = path.resolve(__dirname, "../src-tauri/src/commands/setup.rs")
  const audioRustPath = path.resolve(__dirname, "../src-tauri/src/commands/audio.rs")
  const sharedConfigPath = path.resolve(__dirname, "../../../packages/shared-types/src/config.ts")

  it("1. Shared Types Schema: declares VttEngineIdSchema and VttConfigSchema in GlobalConfigSchema", () => {
    expect(fs.existsSync(sharedConfigPath)).toBe(true)
    const configSource = fs.readFileSync(sharedConfigPath, "utf-8")

    expect(configSource).toContain("export const VttEngineIdSchema")
    expect(configSource).toContain('"whisper_local"')
    expect(configSource).toContain('"whisper_api"')
    expect(configSource).toContain('"nvidia/parakeet-tdt-0.6b-v3"')
    expect(configSource).toContain('"custom"')

    expect(configSource).toContain("export const VttConfigSchema")
    expect(configSource).toContain("vtt: VttConfigSchema.default({})")
    expect(configSource).toContain("vttEngine: z.string().default(\"whisper_local\")")
  })

  it("2. Setup Wizard VTT Onboarding: provides dedicated VTT configuration with distinct engine architectures", () => {
    expect(fs.existsSync(firstRunWizardPath)).toBe(true)
    const wizardSource = fs.readFileSync(firstRunWizardPath, "utf-8")

    // Dedicated VTT section
    expect(wizardSource).toContain("Voice-To-Text (VTT) Transcription Engine")
    expect(wizardSource).toContain("whisper_local")
    expect(wizardSource).toContain("nvidia/parakeet-tdt-0.6b-v3")
    expect(wizardSource).toContain("whisper_api")
    expect(wizardSource).toContain("custom")

    // Architectural differentiation
    expect(wizardSource).toContain("Encoder-Decoder Autoregressive (Whisper.cpp / ONNX)")
    expect(wizardSource).toContain("Fast Conformer RNN-T / TDT Streaming Transducer")

    // Persistence in setup payload & localStorage
    expect(wizardSource).toContain("vttEngine")
    expect(wizardSource).toContain("vttCustomEndpoint")
    expect(wizardSource).toContain("krypton_vtt_config")
  })

  it("3. Codex Settings VTT Configuration: allows selecting STT engine and persists via save_app_settings", () => {
    expect(fs.existsSync(codexSettingsPath)).toBe(true)
    const settingsSource = fs.readFileSync(codexSettingsPath, "utf-8")

    // VTT configuration card
    expect(settingsSource).toContain("Voice-To-Text (VTT) Configuration")
    expect(settingsSource).toContain("whisper_local")
    expect(settingsSource).toContain("nvidia/parakeet-tdt-0.6b-v3")
    expect(settingsSource).toContain("whisper_api")
    expect(settingsSource).toContain("custom")

    // Persistence method
    expect(settingsSource).toContain("persistVttSettings")
    expect(settingsSource).toContain("save_app_settings")
    expect(settingsSource).toContain("krypton_vtt_config")
  })

  it("4. Rust Backend: persists VTT in config.json and handles architecture-specific transcription pipelines", () => {
    expect(fs.existsSync(setupRustPath)).toBe(true)
    const setupRust = fs.existsSync(setupRustPath) ? fs.readFileSync(setupRustPath, "utf-8") : ""
    expect(setupRust).toContain("pub vtt_engine: Option<String>")
    expect(setupRust).toContain("config[\"vtt\"] = vtt")

    expect(fs.existsSync(audioRustPath)).toBe(true)
    const audioRust = fs.readFileSync(audioRustPath, "utf-8")
    expect(audioRust).toContain("resolve_vtt_architecture")
    expect(audioRust).toContain("conformer_rnnt_tdt")
    expect(audioRust).toContain("encoder_decoder_autoregressive")
  })

  it("5. Floating Pill HUD: enforces elevation z-[9999], -webkit-app-region drag, and multi-monitor dragging", () => {
    expect(fs.existsSync(floatingVoiceAgentPath)).toBe(true)
    const voiceSource = fs.readFileSync(floatingVoiceAgentPath, "utf-8")

    // Container drag and elevation
    expect(voiceSource).toContain("z-[9999]")
    expect(voiceSource).toContain("pointer-events-auto")
    expect(voiceSource).toContain('WebkitAppRegion: "drag"')
    expect(voiceSource).toContain('data-tauri-drag-region="true"')

    // Fluid pointer drag listeners on window for multi-monitor support
    expect(voiceSource).toContain('window.addEventListener("pointermove"')
    expect(voiceSource).toContain('window.addEventListener("pointerup"')
  })

  it("6. Animated Orb Gestures: implements single-click (toggle), double-click (collapse/expand), and triple-click (dismiss)", () => {
    const voiceSource = fs.readFileSync(floatingVoiceAgentPath, "utf-8")

    // Click arbiter logic
    expect(voiceSource).toContain("handleOrbClick")
    expect(voiceSource).toContain("clickCountRef.current += 1")
    expect(voiceSource).toContain("setIsOrbOnlyMode")
    expect(voiceSource).toContain("isOrbOnlyMode")
    expect(voiceSource).toContain("isDismissing")
    expect(voiceSource).toContain("setIsDismissing(true)")
  })

  it("7. Custom Agent Selector: renders sleek floating panel (no native select) and declares -webkit-app-region: no-drag", () => {
    const voiceSource = fs.readFileSync(floatingVoiceAgentPath, "utf-8")

    // Declares no-drag
    expect(voiceSource).toContain('WebkitAppRegion: "no-drag"')
    expect(voiceSource).toContain('data-tauri-drag-region="false"')

    // Custom floating panel (not <select>)
    expect(voiceSource).toContain("isAgentMenuOpen")
    expect(voiceSource).toContain("handleAgentSelect")
    expect(voiceSource).toContain("Switch Agent")
    expect(voiceSource).toContain("availableAgents.map")
    expect(voiceSource).not.toContain("<select")
  })

  it("8. Dynamic Live Transcription Area: collapses when idle, expands with live transcription text and dispatch actions", () => {
    const voiceSource = fs.readFileSync(floatingVoiceAgentPath, "utf-8")

    // Collapsing logic
    expect(voiceSource).toContain("hasTranscription")
    expect(voiceSource).toContain("transcription")
    expect(voiceSource).toContain("Idle")
    expect(voiceSource).toContain("Listening")
    expect(voiceSource).toContain("RotateCcw")
    expect(voiceSource).toContain("ArrowUp")
  })

  it("9. Synchronization: chatbar mic button, WindowHeader menu, and hotkey invoke the unified toggleVoiceHud handler", () => {
    const dashboardSource = fs.readFileSync(dashboardPagePath, "utf-8")

    expect(dashboardSource).toContain("toggleVoiceHud = useCallback")
    expect(dashboardSource).toContain("onToggleVoiceHud={toggleVoiceHud}")
    expect(dashboardSource).toContain("onVoiceTrigger={toggleVoiceHud}")
    expect(dashboardSource).toContain("toggleVoiceHud()")

    // Agent context synchronization
    expect(dashboardSource).toContain("onSelectAgent=")
    expect(dashboardSource).toContain("session.setActiveAgentName(agent)")
  })

  it("10. Overlay Page Integration: Tauri /overlay window renders the unified interactive Pill HUD", () => {
    expect(fs.existsSync(overlayPagePath)).toBe(true)
    const overlaySource = fs.readFileSync(overlayPagePath, "utf-8")

    expect(overlaySource).toContain("<FloatingVoiceAgent")
    expect(overlaySource).toContain("hide_overlay")
  })
})
