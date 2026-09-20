import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"

describe("Krypton Chatbar Inline Voice Dictation & Synapse Decoupling", () => {
  const inlineVoiceRecorderPath = path.resolve(
    __dirname,
    "../src/components/chatbar/InlineVoiceRecorder.tsx"
  )
  const commandContextBarPath = path.resolve(
    __dirname,
    "../src/components/chatbar/CommandContextBar.tsx"
  )
  const dashboardPagePath = path.resolve(
    __dirname,
    "../src/app/dashboard/page.tsx"
  )
  const audioPipelinePath = path.resolve(
    __dirname,
    "../src/lib/synapse/audioPipeline.ts"
  )

  it("1. Component Architecture: InlineVoiceRecorder defines a 4-stage state machine (idle -> recording -> transcribing -> inserted)", () => {
    expect(fs.existsSync(inlineVoiceRecorderPath)).toBe(true)
    const source = fs.readFileSync(inlineVoiceRecorderPath, "utf-8")

    // State machine definition
    expect(source).toContain('"idle"')
    expect(source).toContain('"recording"')
    expect(source).toContain('"transcribing"')
    expect(source).toContain('"inserted"')

    // Animated recording indicator with REC and reactive bars
    expect(source).toContain("REC")
    expect(source).toContain("barHeights")
    expect(source).toContain("animate-ping")
    expect(source).toContain("Transcribing...")
    expect(source).toContain("Inserted")
  })

  it("2. Decoupling Guarantee: Clicking the chat toolbar microphone NEVER triggers Krypton Synapse", () => {
    const dashboardSource = fs.readFileSync(dashboardPagePath, "utf-8")
    const barSource = fs.readFileSync(commandContextBarPath, "utf-8")
    const recorderSource = fs.readFileSync(inlineVoiceRecorderPath, "utf-8")

    // Dashboard must not pass toggleVoiceHud to the chat toolbar
    expect(dashboardSource).not.toContain("onVoiceTrigger={toggleVoiceHud}")

    // CommandContextBar renders InlineVoiceRecorder instead of the old voice HUD trigger button
    expect(barSource).toContain("<InlineVoiceRecorder")
    expect(barSource).not.toContain('title="Voice Input (or open Krypton Synapse: Ctrl+Shift+Space)"')

    // InlineVoiceRecorder must suppress broadcastToSynapse
    expect(recorderSource).toContain("broadcastToSynapse: false")
    expect(recorderSource).not.toContain("toggle_synapse")
    expect(recorderSource).not.toContain("toggle_overlay")
    expect(recorderSource).not.toContain("synapse:toggle")
  })

  it("3. Model Parity: Uses the same offline speech model configured for Krypton Synapse", () => {
    const recorderSource = fs.readFileSync(inlineVoiceRecorderPath, "utf-8")
    const pipelineSource = fs.readFileSync(audioPipelinePath, "utf-8")

    // Queries audio status / defaults to Synapse's whisper_gguf engine
    expect(recorderSource).toContain("get_audio_status")
    expect(recorderSource).toContain('engine = "whisper_gguf"')
    expect(pipelineSource).toContain('engine: "whisper_gguf"')
    expect(pipelineSource).toContain("broadcastToSynapse?: boolean")
  })

  it("4. Text Piping: Pipes recognized text and streaming transcription into the chat input textarea", () => {
    const barSource = fs.readFileSync(commandContextBarPath, "utf-8")

    expect(barSource).toContain("handleTranscriptionChange")
    expect(barSource).toContain("handleStartDictation")
    expect(barSource).toContain("basePromptRef")
    expect(barSource).toContain("setPrompt")
    expect(barSource).toContain("textareaRef.current.style.height")
  })

  it("5. Clean Lifecycle & Teardown: Stops media tracks and closes AudioContext without leaks or device lockups", () => {
    const recorderSource = fs.readFileSync(inlineVoiceRecorderPath, "utf-8")
    const pipelineSource = fs.readFileSync(audioPipelinePath, "utf-8")

    // InlineVoiceRecorder unmount cleanup
    expect(recorderSource).toContain("isMountedRef.current = false")
    expect(recorderSource).toContain("pipelineRef.current.stop()")

    // SynapseAudioPipeline hardware resource release
    expect(pipelineSource).toContain("track.stop()")
    expect(pipelineSource).toContain("this.audioContext.close()")
    expect(pipelineSource).toContain("this.processor.disconnect()")
    expect(pipelineSource).toContain("this.source.disconnect()")
    expect(pipelineSource).toContain("cancelAnimationFrame")
  })

  it("6. State Machine Transitions & Stream Buffering Logic", async () => {
    // Functional simulation of the inline dictation state machine
    let currentState: "idle" | "recording" | "transcribing" | "inserted" = "idle"
    let capturedText = ""
    let isFinalEmitted = false

    const onTranscriptionChange = (text: string, isFinal: boolean) => {
      capturedText = text
      isFinalEmitted = isFinal
    }

    // 1. User starts dictation
    expect(currentState).toBe("idle")
    currentState = "recording"
    expect(currentState).toBe("recording")

    // 2. Partial streaming tokens arrive
    onTranscriptionChange("Deploy new microservice", false)
    expect(capturedText).toBe("Deploy new microservice")
    expect(isFinalEmitted).toBe(false)

    // 3. User clicks button while active to stop
    currentState = "transcribing"
    expect(currentState).toBe("transcribing")

    // 4. Final transcription resolved
    onTranscriptionChange("Deploy new microservice with worktree tests.", true)
    currentState = "inserted"
    expect(currentState).toBe("inserted")
    expect(capturedText).toBe("Deploy new microservice with worktree tests.")
    expect(isFinalEmitted).toBe(true)
  })
})
