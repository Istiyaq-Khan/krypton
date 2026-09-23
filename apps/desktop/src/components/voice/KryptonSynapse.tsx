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
  Cpu,
} from "lucide-react"
import { SynapseAudioPipeline } from "@/lib/synapse/audioPipeline"

export type SynapseState = "idle" | "listening" | "thinking" | "speaking" | "error"

export interface KryptonSynapseProps {
  activeAgentName?: string
  onSubmitPrompt?: (prompt: string) => void
  isAssistantThinking?: boolean
  latestAssistantText?: string
  onClose?: () => void
  onSelectAgent?: (agentName: string) => void
  availableAgents?: string[]
  isStandaloneWindow?: boolean
}

export function KryptonSynapse({
  activeAgentName = "Orchestrator",
  onSubmitPrompt,
  isAssistantThinking = false,
  latestAssistantText,
  onClose,
  onSelectAgent,
  availableAgents = ["Orchestrator", "CoderBot", "TesterBot", "Scraper"],
  isStandaloneWindow = false,
}: KryptonSynapseProps) {
  // --- Operational State ---
  const [agentState, setAgentState] = useState<SynapseState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transcription, setTranscription] = useState("")
  const [amplitude, setAmplitude] = useState(0)
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true)

  // --- Layout Modes & Gestures ---
  const [isOrbOnlyMode, setIsOrbOnlyMode] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const renderAnimRef = useRef<number | null>(null)

  // Offline Audio Pipeline
  const pipelineRef = useRef<SynapseAudioPipeline | null>(null)

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

  // Initialize Position on mount (docked bottom-right of active screen for in-DOM mode)
  useEffect(() => {
    if (!isStandaloneWindow && typeof window !== "undefined") {
      const initialX = Math.max(30, window.innerWidth - 480)
      const initialY = Math.max(30, window.innerHeight - 110)
      setPosition({ x: initialX, y: initialY })
    }
  }, [isStandaloneWindow])

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

  // --- Offline Audio Pipeline Control ---
  const startListening = useCallback(async () => {
    try {
      setErrorMessage(null)
      setTranscription("")
      setAgentState("listening")

      if (!pipelineRef.current) {
        pipelineRef.current = new SynapseAudioPipeline({
          engine: "whisper_gguf",
          onAmplitude: (amp) => setAmplitude(amp),
          onTranscription: (text, isFinal) => {
            setTranscription(text)
            if (isFinal) {
              setAgentState("idle")
            }
          },
          onError: (err) => {
            setErrorMessage(err)
            setAgentState("error")
          },
        })
      }

      await pipelineRef.current.start()
    } catch (err: any) {
      console.warn("[Synapse] Microphone start notice:", err)
      setErrorMessage(err?.message || "Microphone hardware unavailable")
      setAgentState("error")
    }
  }, [])

  const stopListening = useCallback(
    async (autoDispatch = true) => {
      let finalTranscript = transcription
      if (pipelineRef.current) {
        try {
          const res = await pipelineRef.current.stop()
          if (res) {
            finalTranscript = res
            setTranscription(res)
          }
        } catch {
          // ignore
        }
      }

      setAmplitude(0)
      setAgentState("idle")

      if (autoDispatch && finalTranscript.trim() && onSubmitPrompt) {
        onSubmitPrompt(finalTranscript.trim())
        setTranscription("")
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

  // --- Multi-Click Gesture Arbiter on Animated Orb ---
  const handleOrbClick = useCallback(() => {
    clickCountRef.current += 1

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }

    clickTimerRef.current = setTimeout(() => {
      const count = clickCountRef.current
      clickCountRef.current = 0

      if (count === 1) {
        // Single Click: Toggle recording listening state
        toggleListening()
      } else if (count === 2) {
        // Double Click: Toggle compact orb-only mode
        setIsOrbOnlyMode((prev) => !prev)
      } else if (count >= 3) {
        // Triple Click: Exit dismiss animation
        setIsDismissing(true)
        setTimeout(async () => {
          if (typeof window !== "undefined" && isTauri()) {
            await invoke("hide_synapse").catch(() => invoke("hide_overlay").catch(() => {}))
          }
          if (onClose) onClose()
          setIsDismissing(false)
        }, 220)
      }
    }, 250)
  }, [toggleListening, onClose])

  // --- Smooth Multi-Monitor Dragging (for in-DOM preview mode) ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isStandaloneWindow) return
    const target = e.target as HTMLElement
    if (target.closest("[data-tauri-drag-region='false']") || target.closest("button") || target.closest("input")) {
      return
    }

    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isStandaloneWindow) return
    const deltaX = e.clientX - dragStartRef.current.mouseX
    const deltaY = e.clientY - dragStartRef.current.mouseY
    setPosition({
      x: dragStartRef.current.initialX + deltaX,
      y: dragStartRef.current.initialY + deltaY,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging && !isStandaloneWindow) {
      setIsDragging(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }

  // Fluid pointer drag listeners on window for multi-monitor support
  useEffect(() => {
    if (!isDragging || isStandaloneWindow) return

    const onPointerMove = (e: PointerEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX
      const deltaY = e.clientY - dragStartRef.current.mouseY
      setPosition({
        x: dragStartRef.current.initialX + deltaX,
        y: dragStartRef.current.initialY + deltaY,
      })
    }

    const onPointerUp = () => {
      setIsDragging(false)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)

    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [isDragging, isStandaloneWindow])

  // --- Animated Canvas Orb Visualizer ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let angle = 0
    let particleAngle = 0

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      const centerX = width / 2
      const centerY = height / 2
      const radius = 18

      ctx.clearRect(0, 0, width, height)

      // State Colors
      let auraColor = "rgba(168, 85, 247, " // violet
      let coreColor = "#a855f7"

      if (agentState === "listening") {
        auraColor = "rgba(16, 185, 129, " // emerald
        coreColor = "#10b981"
      } else if (agentState === "thinking") {
        auraColor = "rgba(59, 130, 246, " // electric blue
        coreColor = "#3b82f6"
      } else if (agentState === "speaking") {
        auraColor = "rgba(236, 72, 153, " // rose pink
        coreColor = "#ec4899"
      } else if (agentState === "error") {
        auraColor = "rgba(244, 63, 94, " // red
        coreColor = "#f43f5e"
      }

      // Responsive Pulse Aura
      const pulse = radius + amplitude * 14 + (agentState === "listening" ? Math.sin(angle * 2) * 3 : 0)
      const grad = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, pulse + 8)
      grad.addColorStop(0, auraColor + "0.8)")
      grad.addColorStop(0.5, auraColor + "0.3)")
      grad.addColorStop(1, auraColor + "0.0)")

      ctx.beginPath()
      ctx.arc(centerX, centerY, pulse + 8, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Counter-rotating Orbital Rings
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(angle)

      ctx.beginPath()
      ctx.ellipse(0, 0, radius + 4, radius - 2, Math.PI / 4, 0, Math.PI * 2)
      ctx.strokeStyle = auraColor + "0.6)"
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.rotate(-angle * 2)
      ctx.beginPath()
      ctx.ellipse(0, 0, radius + 2, radius - 4, -Math.PI / 4, 0, Math.PI * 2)
      ctx.strokeStyle = auraColor + "0.4)"
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()

      // Core Solid Center Orb
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI * 2)
      ctx.fillStyle = coreColor
      ctx.shadowColor = coreColor
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0

      // Particle Aura
      particleAngle += 0.05
      angle += agentState === "thinking" ? 0.08 : 0.02
      renderAnimRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (renderAnimRef.current) {
        cancelAnimationFrame(renderAnimRef.current)
      }
    }
  }, [agentState, amplitude])

  const handleAgentSelect = (agentName: string) => {
    setSelectedAgent(agentName)
    setIsAgentMenuOpen(false)
    if (onSelectAgent) {
      onSelectAgent(agentName)
    }
  }

  const hasTranscription = transcription.trim().length > 0

  return (
    <div
      ref={containerRef}
      data-synapse-window="true"
      style={
        (isStandaloneWindow
          ? { WebkitAppRegion: "drag" }
          : {
              position: "fixed",
              left: `${position.x}px`,
              top: `${position.y}px`,
              WebkitAppRegion: "drag",
            }) as unknown as React.CSSProperties
      }
      data-tauri-drag-region="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`z-[9999] flex items-center select-none transition-all duration-200 pointer-events-auto ${
        isDismissing ? "opacity-0 scale-75" : "opacity-100 scale-100"
      }`}
    >
      {/* Frameless Interactive Glassmorphic Pill Shell */}
      <div
        className={`flex items-center gap-2 rounded-full border border-violet-500/30 bg-zinc-950/85 backdrop-blur-xl px-2.5 py-1.5 shadow-2xl shadow-violet-950/40 transition-all duration-300 ${
          isOrbOnlyMode ? "w-[54px] overflow-hidden" : "w-auto max-w-[620px]"
        }`}
      >
        {/* Left: Interactive Animated Visualizer Orb */}
        <div
          onClick={handleOrbClick}
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          title={
            agentState === "listening"
              ? "Click to stop listening. Double click to collapse. Triple click to close."
              : "Click to speak. Double click to collapse. Triple click to close."
          }
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <canvas ref={canvasRef} width={48} height={48} className="pointer-events-none h-12 w-12" />
        </div>

        {!isOrbOnlyMode && (
          <>
            {/* Middle: Agent Fleet Selector Dropdown */}
            <div className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => setIsAgentMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-violet-500/50 hover:bg-zinc-850 hover:text-white"
              >
                <Bot className="h-3 w-3 text-violet-400" />
                <span className="max-w-[85px] truncate">{selectedAgent}</span>
                <ChevronDown className="h-2.5 w-2.5 text-zinc-400" />
              </button>

              {/* Sleek Custom Floating Agent Fleet Panel */}
              {isAgentMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Switch Agent
                  </div>
                  {availableAgents.map((agent) => (
                    <button
                      key={agent}
                      type="button"
                      onClick={() => handleAgentSelect(agent)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                        selectedAgent === agent
                          ? "bg-violet-600/20 text-violet-200 font-medium"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      }`}
                    >
                      <span className="truncate">{agent}</span>
                      {selectedAgent === agent && <Check className="h-3 w-3 text-violet-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Dynamic Live Transcription & Dispatch Region */}
            <div
              className={`flex items-center gap-2 overflow-hidden transition-all duration-200 ${
                hasTranscription ? "max-w-[340px]" : "max-w-[170px]"
              }`}
            >
              {hasTranscription ? (
                <div
                  className="flex items-center gap-1.5"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                >
                  <span className="max-w-[210px] truncate text-xs font-normal text-zinc-100" title={transcription}>
                    &ldquo;{transcription}&rdquo;
                  </span>
                  <button
                    type="button"
                    onClick={() => setTranscription("")}
                    title="Clear transcription"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stopListening(true)}
                    title="Dispatch prompt to agent"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] font-medium tracking-wide text-zinc-400">
                    {agentState === "listening"
                      ? "Listening"
                      : agentState === "thinking"
                      ? "Thinking"
                      : agentState === "speaking"
                      ? "Speaking"
                      : agentState === "error"
                      ? "Diagnostic"
                      : "Idle"}
                  </span>
                  {agentState === "listening" && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Controls: Audio Output Mute & Close */}
            <div
              className="flex items-center gap-1 pl-1 border-l border-zinc-800/80"
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                type="button"
                onClick={() => setAudioFeedbackEnabled((v) => !v)}
                title={audioFeedbackEnabled ? "Mute speech response" : "Enable speech response"}
                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-850 hover:text-zinc-200"
              >
                {audioFeedbackEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDismissing(true)
                  setTimeout(async () => {
                    if (typeof window !== "undefined" && isTauri()) {
                      await invoke("hide_synapse").catch(() => invoke("hide_overlay").catch(() => {}))
                    }
                    if (onClose) onClose()
                    setIsDismissing(false)
                  }, 200)
                }}
                title="Close Krypton Synapse"
                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-850 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
