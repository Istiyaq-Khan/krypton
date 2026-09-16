"use client"

import React from "react"
import { useVoiceHud } from "@/hooks/useVoiceHud"
import { Mic, MicOff, Square, Send, Bot, Sparkles, X } from "lucide-react"

export default function VoiceOverlayPage() {
  const {
    isRecording,
    amplitude,
    targetAgent,
    setTargetAgent,
    transcription,
    statusPill,
    toggleRecording,
  } = useVoiceHud((text, agent) => {
    console.log(`Dispatched voice prompt to [${agent}]:`, text)
  })

  // 8 dynamic reactive bars for rich waveform
  const baseScale = Math.max(0.15, amplitude)
  const barHeights = [
    Math.round(4 + baseScale * 12 * 0.7),
    Math.round(4 + baseScale * 18 * 0.9),
    Math.round(4 + baseScale * 24 * 1.0),
    Math.round(4 + baseScale * 20 * 0.85),
    Math.round(4 + baseScale * 22 * 0.95),
    Math.round(4 + baseScale * 26 * 1.1),
    Math.round(4 + baseScale * 16 * 0.8),
    Math.round(4 + baseScale * 10 * 0.6),
  ]

  const agentOptions = ["Orchestrator", "Coder", "Scraper"]

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent p-3 select-none">
      {/* Floating Spotlight-Style Micro-HUD Container */}
      <div className="flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-zinc-700/70 bg-zinc-950/90 px-4 py-3 shadow-2xl backdrop-blur-2xl text-zinc-100 animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Left Section: Mic Toggle & Reactive Waveform */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleRecording}
            className={`flex size-10 items-center justify-center rounded-xl shadow-lg transition-all cursor-pointer ${
              isRecording
                ? "bg-rose-600 text-white shadow-rose-600/40 animate-pulse"
                : "bg-violet-600 text-white shadow-violet-600/30 hover:bg-violet-500"
            }`}
            title={isRecording ? "Stop Recording (Esc / Click)" : "Start Voice Recording"}
            aria-label={isRecording ? "Stop Recording" : "Start Voice Recording"}
          >
            {isRecording ? (
              <Square className="size-4 fill-white" />
            ) : (
              <Mic className="size-5" />
            )}
          </button>

          {/* 8 Reactive Waveform Bars */}
          <div className="flex items-center gap-1 h-7 px-1">
            {barHeights.map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ease-out ${
                  isRecording ? "bg-violet-400" : "bg-zinc-700"
                }`}
                style={{ height: isRecording ? `${h}px` : "6px" }}
              />
            ))}
          </div>

          {/* Target Agent Selector Chip */}
          <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300">
            <Bot className="size-3.5 text-violet-400 shrink-0" />
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="bg-transparent text-xs font-medium text-zinc-200 outline-none cursor-pointer pr-1"
            >
              {agentOptions.map((a) => (
                <option key={a} value={a} className="bg-zinc-900 text-zinc-200">
                  [{a}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center Section: Live Streaming Transcription Preview */}
        <div className="flex flex-1 items-center px-3 min-w-0">
          <p
            className={`text-xs leading-relaxed truncate font-medium ${
              transcription ? "text-zinc-100" : "text-zinc-500 italic"
            }`}
          >
            {transcription || "Listening for autonomous instruction (Push to talk)..."}
          </p>
        </div>

        {/* Right Section: Status Pill & Close */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
              statusPill === "Listening..."
                ? "bg-rose-950/80 text-rose-300 border border-rose-600/40 animate-pulse"
                : statusPill === "Dispatched"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-600/40"
                : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/40"
            }`}
          >
            {statusPill}
          </span>
        </div>
      </div>
    </div>
  )
}
