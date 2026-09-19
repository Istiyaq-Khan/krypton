"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  Mic,
  MicOff,
  Square,
  Sparkles,
  Bot,
  ChevronDown,
  Volume2,
  VolumeX,
  X,
  Check,
  AlertCircle,
  RotateCcw,
  Send,
  ArrowUp,
  Layers,
} from "lucide-react"

export type VoiceAgentState = "idle" | "listening" | "thinking" | "speaking" | "error"

export interface FloatingVoiceAgentProps {
  activeAgentName?: string
  onSubmitPrompt?: (prompt: string) => void
  isAssistantThinking?: boolean
  latestAssistantText?: string
  onClose?: () => void
  onSelectAgent?: (agentName: string) => void
  availableAgents?: string[]
}

export function FloatingVoiceAgent({
  activeAgentName = "Orchestrator",
  onSubmitPrompt,
  isAssistantThinking = false,
  latestAssistantText,
  onClose,
  onSelectAgent,
  availableAgents = ["Orchestrator", "CoderBot", "TesterBot", "Scraper"],
}: FloatingVoiceAgentProps) {
  // --- Operational State ---
  const [agentState, setAgentState] = useState<VoiceAgentState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transcription, setTranscription] = useState("")
  const [amplitude, setAmplitude] = useState(0)
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true)

  // --- Layout Modes & Gestures ---
  // Double-click on orb toggles compact orb-only mode vs full pill
  const [isOrbOnlyMode, setIsOrbOnlyMode] = useState(false)
  // Triple-click or close triggers exit dismiss transition
  const [isDismissing, setIsDismissing] = useState(false)
  // Middle agent selector floating dropdown
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(activeAgentName)

  // Multi-click arbiter refs for Animated Orb
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)

  // --- Smooth Multi-Monitor Dragging ---
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)

  // --- Web Audio & Speech Recognition ---
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const renderAnimRef = useRef<number | null>(null)

  // Synchronize incoming activeAgentName
  useEffect(() => {
    if (activeAgentName) {
      setSelectedAgent(activeAgentName)
    }
  }, [activeAgentName])

  // Synchronize state with assistant thinking/speaking
  useEffect(() => {
    if (isAssistantThinking) {
      setAgentState("thinking")
    } else if (agentState === "thinking") {
      if (latestAssistantText && audioFeedbackEnabled) {
        setAgentState("speaking")
        speakAssistantText(latestAssistantText)
      } else {
        setAgentState("idle")
      }
    }
  }, [isAssistantThinking, latestAssistantText, audioFeedbackEnabled])

  // Initialize Position on mount (docked bottom-right of active screen)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const initialX = Math.max(30, window.innerWidth - 480)
      const initialY = Math.max(30, window.innerHeight - 110)
      setPosition({ x: initialX, y: initialY })
    }
  }, [])

  // --- Audio Synthesis (Speaking State) ---
  const speakAssistantText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setAgentState("idle")
      return
    }

    try {
      window.speechSynthesis.cancel()
      const cleanText = text
        .replace(/```[\s\S]*?```/g, "Code block omitted.")
        .replace(/`([^`]+)`/g, "$1")
        .slice(0, 240)

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.rate = 1.05
      utterance.pitch = 1.0

      utterance.onend = () => setAgentState("idle")
      utterance.onerror = () => setAgentState("idle")

      window.speechSynthesis.speak(utterance)
    } catch {
      setAgentState("idle")
    }
  }, [])

  // --- Speech Recognition (Listening State) ---
  const startListening = useCallback(async () => {
    try {
      setErrorMessage(null)
      setTranscription("")
      setAgentState("listening")

      // 1. Notify Tauri backend audio pipeline if available
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("start_audio_capture", { provider: "whisper_local" })
        } catch (e) {
          console.warn("Tauri start_audio_capture notice:", e)
        }
      }

      // 2. Web Audio API Analyser for organic dynamic visual reaction
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStreamRef.current = stream

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        analyser.smoothingTimeConstant = 0.8
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        analyserRef.current = analyser
      }

      // 3. Real Web Speech API for real-time speech-to-text
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"

        recognition.onresult = (event: any) => {
          let currentTranscript = ""
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript
          }
          if (currentTranscript.trim()) {
            setTranscription(currentTranscript.trim())
          }
        }

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition event:", event.error)
          if (event.error !== "no-speech") {
            setErrorMessage(`Microphone: ${event.error}`)
            setAgentState("error")
          }
        }

        recognition.start()
        recognitionRef.current = recognition
      } else {
        setTranscription("Speech recognition active. Speak instruction...")
      }
    } catch (err: any) {
      console.warn("Microphone access request:", err)
      setErrorMessage(err.message || "Microphone hardware unavailable")
      setAgentState("error")
    }
  }, [])

  const stopListening = useCallback(
    async (autoDispatch = true) => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
        recognitionRef.current = null
      }

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
      }

      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }

      analyserRef.current = null
      setAmplitude(0)

      // Notify Tauri backend
      if (typeof window !== "undefined" && isTauri()) {
        try {
          const res = await invoke<{ transcript: string }>("stop_audio_capture")
          if (res.transcript && !transcription.trim()) {
            setTranscription(res.transcript)
          }
        } catch (e) {
          console.warn("Tauri stop_audio_capture notice:", e)
        }
      }

      if (autoDispatch && transcription.trim() && onSubmitPrompt) {
        setAgentState("thinking")
        onSubmitPrompt(transcription.trim())
        setTranscription("")
      } else {
        setAgentState("idle")
      }
    },
    [transcription, onSubmitPrompt]
  )

  const toggleListening = useCallback(() => {
    if (agentState === "listening") {
      stopListening(true)
    } else {
      startListening()
    }
  }, [agentState, startListening, stopListening])

  // --- Multi-Click Gesture Detection on Animated Orb ---
  const handleOrbClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      clickCountRef.current += 1

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }

      if (clickCountRef.current === 1) {
        clickTimerRef.current = setTimeout(() => {
          clickCountRef.current = 0
          // Single Click: Toggle listening / push-to-talk
          toggleListening()
        }, 260)
      } else if (clickCountRef.current === 2) {
        clickTimerRef.current = setTimeout(() => {
          clickCountRef.current = 0
          // Double Click: Toggle orb-only collapsed mode
          setIsOrbOnlyMode((prev) => !prev)
        }, 240)
      } else if (clickCountRef.current >= 3) {
        clickCountRef.current = 0
        // Triple Click: Trigger exit/dismiss animation and close
        setIsDismissing(true)
        setTimeout(() => {
          onClose?.()
        }, 320)
      }
    },
    [toggleListening, onClose]
  )

  // --- Organic Canvas Visualizer ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let angle = 0
    const particles = Array.from({ length: 20 }, (_, i) => ({
      baseAngle: (i / 20) * Math.PI * 2,
      distance: 14 + (i % 3) * 4,
      speed: 0.025 + (i % 4) * 0.008,
      size: 1.2 + (i % 3) * 0.6,
    }))

    const dataArray = new Uint8Array(32)

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      let currentAmp = 0
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        currentAmp = Math.min(1, sum / dataArray.length / 110)
        setAmplitude(currentAmp)
      }

      angle += agentState === "thinking" ? 0.08 : 0.025

      let primaryColor = "168, 85, 247" // violet
      let glowColor = "147, 51, 234"
      if (agentState === "listening") {
        primaryColor = "16, 185, 129" // emerald
        glowColor = "5, 150, 105"
      } else if (agentState === "thinking") {
        primaryColor = "59, 130, 246" // electric blue
        glowColor = "37, 99, 235"
      } else if (agentState === "speaking") {
        primaryColor = "236, 72, 153" // rose pink
        glowColor = "219, 39, 119"
      } else if (agentState === "error") {
        primaryColor = "244, 63, 94" // rose red
        glowColor = "225, 29, 72"
      }

      const pulseScale =
        1 + (agentState === "listening" ? currentAmp * 0.7 : Math.sin(angle * 2) * 0.08)

      // Core radial glow
      const grad = ctx.createRadialGradient(
        centerX,
        centerY,
        2,
        centerX,
        centerY,
        18 * pulseScale
      )
      grad.addColorStop(0, `rgba(${primaryColor}, 0.9)`)
      grad.addColorStop(0.5, `rgba(${glowColor}, 0.4)`)
      grad.addColorStop(1, `rgba(${primaryColor}, 0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(centerX, centerY, 20 * pulseScale, 0, Math.PI * 2)
      ctx.fill()

      // Orbital Rings
      const ringRadius = 14 * pulseScale
      ctx.save()
      ctx.translate(centerX, centerY)

      ctx.rotate(angle)
      ctx.strokeStyle = `rgba(${primaryColor}, 0.65)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(0, 0, ringRadius, ringRadius * 0.7, 0, 0, Math.PI * 2)
      ctx.stroke()

      ctx.rotate(-angle * 1.6)
      ctx.strokeStyle = `rgba(${primaryColor}, 0.4)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, ringRadius * 0.8, ringRadius * 0.45, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // Particle Aura
      for (const p of particles) {
        const curAngle = p.baseAngle + angle * (agentState === "thinking" ? 2 : 1)
        const curDist =
          p.distance * (1 + (agentState === "listening" ? currentAmp * 0.5 : 0))
        const px = centerX + Math.cos(curAngle) * curDist
        const py = centerY + Math.sin(curAngle) * curDist

        ctx.fillStyle = `rgba(${primaryColor}, 0.8)`
        ctx.beginPath()
        ctx.arc(px, py, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      renderAnimRef.current = requestAnimationFrame(render)
    }

    render()
    return () => {
      if (renderAnimRef.current) cancelAnimationFrame(renderAnimRef.current)
    }
  }, [agentState])

  // --- Multi-Monitor Dragging Handler ---
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("input") || target.closest("textarea")) {
      return
    }

    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    }

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartRef.current.mouseX
      const dy = ev.clientY - dragStartRef.current.mouseY
      // Free dragging without boundary lock across multi-monitors
      setPosition({
        x: dragStartRef.current.initialX + dx,
        y: dragStartRef.current.initialY + dy,
      })
    }

    const onPointerUp = () => {
      setIsDragging(false)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  }

  // Handle agent selection
  const handleAgentSelect = (agentName: string) => {
    setSelectedAgent(agentName)
    setIsAgentMenuOpen(false)
    onSelectAgent?.(agentName)
  }

  const hasTranscription = Boolean(transcription.trim())

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      data-tauri-drag-region="true"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
      className={`fixed top-0 left-0 z-[9999] pointer-events-auto select-none transition-all duration-300 ${
        isDismissing
          ? "opacity-0 scale-75 -translate-y-2 pointer-events-none"
          : "opacity-100 scale-100"
      } ${isDragging ? "cursor-grabbing shadow-[0_16px_48px_rgba(0,0,0,0.75)]" : "cursor-grab"}`}
    >
      {/* COMPACT ROUNDED PILL HUD */}
      <div
        data-tauri-drag-region="true"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        className="relative flex items-center gap-2 p-1.5 rounded-full border border-white/[0.14] bg-zinc-950/90 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.65)] text-zinc-100 transition-all duration-300"
      >
        {/* ============================================================ */}
        {/* 1. ANIMATED ORB (LEFT)                                      */}
        {/*    Single click: Push-to-talk / Listen                      */}
        {/*    Double click: Compress to Orb mode / Expand              */}
        {/*    Triple click: Play exit transition and Dismiss           */}
        {/* ============================================================ */}
        <div
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          onClick={handleOrbClick}
          className="relative flex size-10 items-center justify-center rounded-full bg-zinc-900/90 border border-white/10 hover:border-violet-500/50 transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95 shrink-0 pointer-events-auto group"
          title="Single click: Voice toggle | Double click: Collapse/Expand | Triple click: Dismiss"
        >
          <canvas ref={canvasRef} width={40} height={40} className="size-full rounded-full" />
          {/* Centered micro-icon showing state */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {agentState === "listening" ? (
              <Square className="size-3.5 fill-emerald-400 text-emerald-400 animate-pulse" />
            ) : agentState === "thinking" ? (
              <Sparkles className="size-3.5 text-sky-400 animate-spin" />
            ) : agentState === "speaking" ? (
              <Volume2 className="size-3.5 text-pink-400" />
            ) : agentState === "error" ? (
              <AlertCircle className="size-3.5 text-rose-400" />
            ) : (
              <Mic className="size-3.5 text-zinc-300 group-hover:text-violet-300 transition-colors" />
            )}
          </div>
        </div>

        {/* When NOT in compressed orb-only mode, render Middle & Right sections */}
        {!isOrbOnlyMode && (
          <>
            {/* ======================================================== */}
            {/* 2. AGENT SELECTOR BUTTON (MIDDLE)                        */}
            {/*    Displays active agent name, opens custom floating      */}
            {/*    panel, declares WebkitAppRegion: "no-drag"            */}
            {/* ======================================================== */}
            <div
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="relative shrink-0 pointer-events-auto"
            >
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => setIsAgentMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer pointer-events-auto"
                title="Switch active agent context"
              >
                <Bot className="size-3.5 text-violet-400 shrink-0" />
                <span className="font-mono text-[11px] tracking-tight truncate max-w-[90px]">
                  {selectedAgent}
                </span>
                <ChevronDown
                  className={`size-3 text-zinc-400 transition-transform duration-200 ${
                    isAgentMenuOpen ? "rotate-180 text-violet-400" : ""
                  }`}
                />
              </button>

              {/* Custom Sleek Floating Agent Selector Panel */}
              {isAgentMenuOpen && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute bottom-full mb-2 left-0 w-52 rounded-2xl border border-zinc-800/90 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl p-1.5 z-[10000] text-zinc-100 animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-auto"
                >
                  <div className="px-2 py-1 mb-1 border-b border-zinc-900/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      Switch Agent
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {availableAgents.length} Active
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {availableAgents.map((agent) => (
                      <button
                        key={agent}
                        type="button"
                        data-tauri-drag-region="false"
                        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                        onClick={() => handleAgentSelect(agent)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left transition-colors cursor-pointer pointer-events-auto ${
                          selectedAgent === agent
                            ? "bg-violet-950/60 text-violet-200 border border-violet-800/50"
                            : "hover:bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-1.5 rounded-full ${
                              selectedAgent === agent ? "bg-violet-400" : "bg-zinc-600"
                            }`}
                          />
                          <span className="font-medium text-[11px] truncate">{agent}</span>
                        </div>
                        {selectedAgent === agent && (
                          <Check className="size-3 text-violet-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* 3. LIVE TRANSCRIPTION DISPLAY AREA (RIGHT)               */}
            {/*    Collapses into clean idle pill when empty,            */}
            {/*    expands dynamically when speech is present             */}
            {/* ======================================================== */}
            <div
              data-tauri-drag-region="true"
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
              className={`flex items-center transition-all duration-300 ease-in-out ${
                hasTranscription
                  ? "max-w-[280px] opacity-100 px-2"
                  : "max-w-[90px] opacity-90 px-1"
              }`}
            >
              {hasTranscription ? (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="flex items-center gap-2 min-w-0 pointer-events-auto"
                >
                  <p className="text-xs leading-tight font-medium text-zinc-100 truncate max-w-[180px]">
                    {transcription}
                  </p>

                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => setTranscription("")}
                    className="flex size-6 items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors pointer-events-auto cursor-pointer"
                    title="Clear transcription"
                  >
                    <RotateCcw className="size-3" />
                  </button>

                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => stopListening(true)}
                    className="flex size-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all pointer-events-auto cursor-pointer"
                    title="Dispatch Prompt (Enter)"
                  >
                    <ArrowUp className="size-3 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                /* Idle Collapsed State Indicator */
                <div
                  data-tauri-drag-region="true"
                  style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-400 px-1 font-mono tracking-tight"
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      agentState === "listening"
                        ? "bg-emerald-400 animate-pulse"
                        : agentState === "thinking"
                        ? "bg-sky-400 animate-pulse"
                        : "bg-zinc-600"
                    }`}
                  />
                  <span>
                    {agentState === "listening"
                      ? "Listening"
                      : agentState === "thinking"
                      ? "Thinking"
                      : "Idle"}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Audio Mute & Dismiss Buttons */}
            <div
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex items-center gap-1 pl-1 border-l border-zinc-800/80 pr-1 pointer-events-auto"
            >
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => setAudioFeedbackEnabled(!audioFeedbackEnabled)}
                className="flex size-6 items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors pointer-events-auto cursor-pointer"
                title={audioFeedbackEnabled ? "Mute Readout" : "Enable Readout"}
              >
                {audioFeedbackEnabled ? (
                  <Volume2 className="size-3" />
                ) : (
                  <VolumeX className="size-3 text-zinc-500" />
                )}
              </button>

              {onClose && (
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    setIsDismissing(true)
                    setTimeout(() => onClose(), 280)
                  }}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors pointer-events-auto cursor-pointer"
                  title="Close Voice HUD"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error alert floating pill */}
      {errorMessage && (
        <div
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/90 border border-rose-800/70 text-[11px] text-rose-300 shadow-xl pointer-events-auto"
        >
          <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
          <span className="truncate max-w-[220px]">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 underline text-[10px]"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
