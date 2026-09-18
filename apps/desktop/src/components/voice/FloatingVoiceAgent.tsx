"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Mic,
  MicOff,
  Square,
  Sparkles,
  ChevronDown,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  RotateCcw,
  Send,
  Move,
} from "lucide-react"

export type VoiceAgentState = "idle" | "listening" | "thinking" | "speaking" | "error"

export interface FloatingVoiceAgentProps {
  activeAgentName?: string
  onSubmitPrompt?: (prompt: string) => void
  isAssistantThinking?: boolean
  latestAssistantText?: string
  onClose?: () => void
}

export function FloatingVoiceAgent({
  activeAgentName = "Orchestrator",
  onSubmitPrompt,
  isAssistantThinking = false,
  latestAssistantText,
  onClose,
}: FloatingVoiceAgentProps) {
  // --- Operational State ---
  const [agentState, setAgentState] = useState<VoiceAgentState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [transcription, setTranscription] = useState("")
  const [amplitude, setAmplitude] = useState(0)
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true)

  // --- Physics & Drag Coordinates ---
  // Default docked at bottom-right corner
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 })
  const velocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0 })
  const springAnimRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // --- Web Audio & Speech Recognition ---
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const renderAnimRef = useRef<number | null>(null)

  // Synchronize state with incoming props
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

  // Initialize Position on mount (docked bottom-right)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const initialX = Math.max(20, window.innerWidth - 440)
      const initialY = Math.max(20, window.innerHeight - 200)
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

      utterance.onend = () => {
        setAgentState("idle")
      }
      utterance.onerror = () => {
        setAgentState("idle")
      }

      window.speechSynthesis.speak(utterance)
    } catch {
      setAgentState("idle")
    }
  }, [])

  // --- Real Speech Recognition (Listening State) ---
  const startListening = useCallback(async () => {
    try {
      setErrorMessage(null)
      setTranscription("")
      setAgentState("listening")

      // 1. Web Audio API Analyser for organic dynamic visual reaction
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

      // 2. Real Web Speech API for real-time speech-to-text
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
            setErrorMessage(`Microphone notice: ${event.error}`)
            setAgentState("error")
          }
        }

        recognition.onend = () => {
          // Auto clean if still listening
        }

        recognition.start()
        recognitionRef.current = recognition
      } else {
        // Fallback for browsers without SpeechRecognition
        setTranscription("Speech recognition engine ready. Type or speak instruction...")
      }
    } catch (err: any) {
      console.warn("Microphone access request:", err)
      setErrorMessage(err.message || "Microphone hardware unavailable")
      setAgentState("error")
    }
  }, [])

  const stopListening = useCallback((autoDispatch = true) => {
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

    if (autoDispatch && transcription.trim() && onSubmitPrompt) {
      setAgentState("thinking")
      onSubmitPrompt(transcription.trim())
      setTranscription("")
    } else {
      setAgentState("idle")
    }
  }, [transcription, onSubmitPrompt])

  const toggleListening = useCallback(() => {
    if (agentState === "listening") {
      stopListening(true)
    } else {
      startListening()
    }
  }, [agentState, startListening, stopListening])

  // --- Organic Canvas Visualizer ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let angle = 0
    const particles = Array.from({ length: 24 }, (_, i) => ({
      baseAngle: (i / 24) * Math.PI * 2,
      distance: 22 + (i % 3) * 6,
      speed: 0.02 + (i % 4) * 0.008,
      size: 1.5 + (i % 3) * 0.8,
    }))

    const dataArray = new Uint8Array(32)

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      // Read audio frequency amplitude if analyser connected
      let currentAmp = 0
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        currentAmp = Math.min(1, (sum / dataArray.length) / 110)
        setAmplitude(currentAmp)
      }

      angle += agentState === "thinking" ? 0.08 : 0.02

      // Color Palette based on agentState
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

      // 1. Ambient Radial Glow Core
      const pulseScale = 1 + (agentState === "listening" ? currentAmp * 0.8 : Math.sin(angle * 2) * 0.08)
      const grad = ctx.createRadialGradient(
        centerX,
        centerY,
        4,
        centerX,
        centerY,
        28 * pulseScale
      )
      grad.addColorStop(0, `rgba(${primaryColor}, 0.85)`)
      grad.addColorStop(0.5, `rgba(${glowColor}, 0.35)`)
      grad.addColorStop(1, `rgba(${primaryColor}, 0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(centerX, centerY, 32 * pulseScale, 0, Math.PI * 2)
      ctx.fill()

      // 2. Dual Refractive Orbital Rings
      const ringRadius = 22 * pulseScale
      ctx.save()
      ctx.translate(centerX, centerY)

      // Outer Ring
      ctx.rotate(angle)
      ctx.strokeStyle = `rgba(${primaryColor}, 0.6)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(0, 0, ringRadius, ringRadius * 0.72, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Inner Counter-Rotating Ring
      ctx.rotate(-angle * 1.6)
      ctx.strokeStyle = `rgba(${primaryColor}, 0.35)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, ringRadius * 0.82, ringRadius * 0.5, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // 3. Floating Orbital Particle Aura
      for (const p of particles) {
        const curAngle = p.baseAngle + angle * (agentState === "thinking" ? 2 : 1)
        const curDist = p.distance * (1 + (agentState === "listening" ? currentAmp * 0.5 : 0))
        const px = centerX + Math.cos(curAngle) * curDist
        const py = centerY + Math.sin(curAngle) * curDist

        ctx.fillStyle = `rgba(${primaryColor}, 0.75)`
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

  // --- Smooth Inertia Dragging & Magnetic Docking Physics ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from handle or non-button areas
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("input") || target.closest("textarea")) {
      return
    }

    if (springAnimRef.current) cancelAnimationFrame(springAnimRef.current)
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    }
    velocityRef.current = { vx: 0, vy: 0, lastX: position.x, lastY: position.y, lastTime: performance.now() }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const now = performance.now()
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY

    const newX = dragStartRef.current.initialX + dx
    const newY = dragStartRef.current.initialY + dy

    // Calculate instantaneous velocity for inertia
    const dt = Math.max(1, now - velocityRef.current.lastTime)
    velocityRef.current.vx = ((newX - velocityRef.current.lastX) / dt) * 16.6
    velocityRef.current.vy = ((newY - velocityRef.current.lastY) / dt) * 16.6
    velocityRef.current.lastX = newX
    velocityRef.current.lastY = newY
    velocityRef.current.lastTime = now

    // Bound within viewport bounds
    const maxX = Math.max(10, window.innerWidth - (isExpanded ? 430 : 90))
    const maxY = Math.max(10, window.innerHeight - (isExpanded ? 190 : 90))
    const boundedX = Math.min(Math.max(12, newX), maxX)
    const boundedY = Math.min(Math.max(12, newY), maxY)

    setPosition({ x: boundedX, y: boundedY })
  }

  const handlePointerUp = () => {
    if (!isDragging) return
    setIsDragging(false)

    // Apply inertia and magnetic docking spring physics
    let curX = position.x + velocityRef.current.vx * 3
    let curY = position.y + velocityRef.current.vy * 3

    const maxX = Math.max(10, window.innerWidth - (isExpanded ? 430 : 90))
    const maxY = Math.max(10, window.innerHeight - (isExpanded ? 190 : 90))

    // Magnetic Docking to closest edge if within 90px threshold
    const DOCK_THRESHOLD = 90
    let targetX = Math.min(Math.max(16, curX), maxX)
    let targetY = Math.min(Math.max(16, curY), maxY)

    if (targetX < DOCK_THRESHOLD) targetX = 16
    else if (targetX > maxX - DOCK_THRESHOLD) targetX = maxX

    if (targetY < DOCK_THRESHOLD) targetY = 16
    else if (targetY > maxY - DOCK_THRESHOLD) targetY = maxY

    // Realistic Spring Formula (stiffness: 300, damping: 28, mass: 0.8)
    let vx = velocityRef.current.vx
    let vy = velocityRef.current.vy
    const stiffness = 300
    const damping = 28
    const mass = 0.8
    const dt = 0.016

    const stepSpring = () => {
      const fx = -stiffness * (curX - targetX) - damping * vx
      const fy = -stiffness * (curY - targetY) - damping * vy

      const ax = fx / mass
      const ay = fy / mass

      vx += ax * dt
      vy += ay * dt

      curX += vx * dt
      curY += vy * dt

      setPosition({ x: curX, y: curY })

      if (Math.abs(curX - targetX) > 0.5 || Math.abs(curY - targetY) > 0.5 || Math.abs(vx) > 0.5) {
        springAnimRef.current = requestAnimationFrame(stepSpring)
      } else {
        setPosition({ x: targetX, y: targetY })
      }
    }

    springAnimRef.current = requestAnimationFrame(stepSpring)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
      }}
      className={`fixed top-0 left-0 z-50 select-none transition-shadow ${
        isDragging ? "cursor-grabbing shadow-[0_16px_48px_rgba(0,0,0,0.7)]" : "cursor-grab"
      }`}
    >
      {/* Minimized Floating Presence Orb */}
      {!isExpanded ? (
        <div
          onClick={() => setIsExpanded(true)}
          className="group relative flex size-16 items-center justify-center rounded-full border border-white/[0.12] bg-zinc-950/85 backdrop-blur-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          title="Click to expand Krypton Voice HUD"
        >
          <canvas ref={canvasRef} width={64} height={64} className="size-full rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full">
            <Maximize2 className="size-4 text-zinc-200" />
          </div>
        </div>
      ) : (
        /* Expanded Tactile Voice Command Card */
        <div className="relative flex w-[410px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/85 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-zinc-100 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Top Drag & Window Controls Bar */}
          <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5 border-b border-zinc-900/60 bg-zinc-950/50">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="font-semibold text-xs text-zinc-200 tracking-tight">Krypton Voice Agent</span>
              <span className="text-[10px] text-zinc-500 font-mono">[{activeAgentName}]</span>
            </div>

            <div className="flex items-center gap-1 text-zinc-400">
              <button
                type="button"
                onClick={() => setAudioFeedbackEnabled(!audioFeedbackEnabled)}
                className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors"
                title={audioFeedbackEnabled ? "Mute Voice Readout" : "Enable Voice Readout"}
              >
                {audioFeedbackEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors"
                title="Minimize Floating Orb"
              >
                <Minimize2 className="size-3.5" />
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 hover:text-rose-400 transition-colors"
                  title="Close Floating Voice Agent"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Main Visualizer & Audio Reactive Stage */}
          <div className="flex items-center gap-3.5 px-4 py-3">
            {/* Canvas Organic Visualizer */}
            <div className="relative shrink-0 flex size-14 items-center justify-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 shadow-inner">
              <canvas ref={canvasRef} width={56} height={56} className="size-full rounded-2xl" />
            </div>

            {/* Live Real Speech Transcription Preview */}
            <div className="flex flex-1 flex-col justify-center min-w-0 pr-1">
              <div className="flex items-center justify-between pb-1">
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    agentState === "listening"
                      ? "text-emerald-400"
                      : agentState === "thinking"
                      ? "text-sky-400 animate-pulse"
                      : agentState === "speaking"
                      ? "text-pink-400"
                      : agentState === "error"
                      ? "text-rose-400"
                      : "text-zinc-500"
                  }`}
                >
                  {agentState === "listening"
                    ? "Listening..."
                    : agentState === "thinking"
                    ? "Reasoning..."
                    : agentState === "speaking"
                    ? "Speaking..."
                    : agentState === "error"
                    ? "Diagnostic Alert"
                    : "Ready"}
                </span>

                {amplitude > 0 && agentState === "listening" && (
                  <span className="text-[10px] font-mono text-emerald-500/80">
                    {Math.round(amplitude * 100)}%
                  </span>
                )}
              </div>

              <p className="text-xs leading-snug line-clamp-2 font-medium text-zinc-200">
                {transcription || (
                  <span className="text-zinc-500 italic">
                    {agentState === "listening"
                      ? "Speak your instruction..."
                      : "Click mic or press push-to-talk..."}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Error Alert Display if present */}
          {errorMessage && (
            <div className="flex items-center gap-2 mx-3.5 mb-2 px-2.5 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800/50 text-[11px] text-rose-300">
              <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
              <span className="truncate flex-1">{errorMessage}</span>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null)
                  setAgentState("idle")
                }}
                className="hover:underline text-rose-200"
              >
                Clear
              </button>
            </div>
          )}

          {/* Interactive Controls Footer */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-zinc-900/60 bg-zinc-950/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 font-medium text-xs shadow-lg transition-all cursor-pointer ${
                  agentState === "listening"
                    ? "bg-rose-600 text-white shadow-rose-600/30 animate-pulse hover:bg-rose-500"
                    : "bg-violet-600 text-white shadow-violet-600/30 hover:bg-violet-500"
                }`}
              >
                {agentState === "listening" ? (
                  <>
                    <Square className="size-3.5 fill-white" />
                    <span>Stop & Send</span>
                  </>
                ) : (
                  <>
                    <Mic className="size-3.5" />
                    <span>Voice Input</span>
                  </>
                )}
              </button>

              {transcription && (
                <button
                  type="button"
                  onClick={() => setTranscription("")}
                  className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Clear input"
                >
                  <RotateCcw className="size-3" />
                </button>
              )}
            </div>

            {/* Send manual prompt trigger */}
            {transcription && (
              <button
                type="button"
                onClick={() => stopListening(true)}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 font-medium transition-colors cursor-pointer"
              >
                <span>Dispatch</span>
                <Send className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
