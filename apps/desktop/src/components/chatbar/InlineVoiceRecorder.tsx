"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { Mic, Square, Loader2, Check, AlertCircle } from "lucide-react"
import { SynapseAudioPipeline } from "@/lib/synapse/audioPipeline"

export type DictationState = "idle" | "recording" | "transcribing" | "inserted" | "error"

export interface InlineVoiceRecorderProps {
  onTranscriptionChange: (text: string, isFinal: boolean) => void
  onStartRecording?: () => void
  onStopRecording?: () => void
  disabled?: boolean
  className?: string
}

/**
 * InlineVoiceRecorder — Real-time Chat Toolbar Voice Dictation Component.
 *
 * Implements a 4-stage state machine:
 * idle -> recording -> transcribing -> inserted.
 *
 * Captures microphone PCM audio buffers via Web Audio API and pipes them to
 * the local offline STT service using the exact same model downloaded for Synapse
 * (whisper-tiny-q8_0 / whisper_gguf), without triggering the Synapse floating HUD.
 */
export function InlineVoiceRecorder({
  onTranscriptionChange,
  onStartRecording,
  onStopRecording,
  disabled = false,
  className = "",
}: InlineVoiceRecorderProps) {
  const [state, setState] = useState<DictationState>("idle")
  const [amplitude, setAmplitude] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const pipelineRef = useRef<SynapseAudioPipeline | null>(null)
  const isMountedRef = useRef(true)

  // Start dictation recording session
  const startRecording = useCallback(async () => {
    if (disabled || state !== "idle") return

    try {
      setErrorMessage(null)
      setState("recording")
      onStartRecording?.()

      // Dynamically resolve active STT model/provider configured in system to match Synapse
      let engine = "whisper_gguf"
      if (typeof window !== "undefined" && isTauri()) {
        try {
          const status = await invoke<{ provider: string }>("get_audio_status")
          if (status?.provider) {
            engine = status.provider
          }
        } catch {
          // Fallback to whisper_gguf
        }
      } else if (typeof window !== "undefined") {
        const stored = localStorage.getItem("krypton_vtt_engine")
        if (stored) engine = stored
      }

      const pipeline = new SynapseAudioPipeline({
        engine,
        // Suppress broadcast_synapse_transcription to isolate inline dictation from Synapse window
        broadcastToSynapse: false,
        onAmplitude: (amp) => {
          if (isMountedRef.current) setAmplitude(amp)
        },
        onTranscription: (text, isFinal) => {
          if (!isMountedRef.current) return
          onTranscriptionChange(text, isFinal)
          if (isFinal) {
            setState("inserted")
            setTimeout(() => {
              if (isMountedRef.current) {
                setState("idle")
                setAmplitude(0)
              }
            }, 1200)
          }
        },
        onError: (err) => {
          console.warn("[InlineVoiceRecorder] Audio capture error:", err)
          if (isMountedRef.current) {
            setErrorMessage(err)
            setState("error")
            setTimeout(() => {
              if (isMountedRef.current) {
                setState("idle")
                setAmplitude(0)
              }
            }, 2000)
          }
        },
      })

      pipelineRef.current = pipeline
      await pipeline.start()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Microphone hardware unavailable"
      console.warn("[InlineVoiceRecorder] Failed to start audio capture:", msg)
      if (isMountedRef.current) {
        setState("error")
        setErrorMessage(msg)
        setTimeout(() => {
          if (isMountedRef.current) {
            setState("idle")
            setAmplitude(0)
          }
        }, 2000)
      }
    }
  }, [disabled, state, onStartRecording, onTranscriptionChange])

  // Stop recording and finalize transcription
  const stopRecording = useCallback(async () => {
    if (state !== "recording") return

    setState("transcribing")
    onStopRecording?.()

    if (pipelineRef.current) {
      try {
        await pipelineRef.current.stop()
      } catch (err) {
        console.warn("[InlineVoiceRecorder] Stop audio capture notice:", err)
        if (isMountedRef.current) {
          setState("idle")
          setAmplitude(0)
        }
      } finally {
        pipelineRef.current = null
      }
    } else {
      if (isMountedRef.current) {
        setState("idle")
        setAmplitude(0)
      }
    }
  }, [state, onStopRecording])

  // Toggle recording on button click
  const handleToggle = () => {
    if (state === "idle") {
      startRecording()
    } else if (state === "recording") {
      stopRecording()
    }
  }

  // Teardown and cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (pipelineRef.current) {
        pipelineRef.current.stop().catch(() => {})
        pipelineRef.current = null
      }
    }
  }, [])

  // Bar heights calculation for responsive equalizer waveform
  const baseScale = Math.max(0.15, amplitude)
  const barHeights = [
    Math.round(4 + baseScale * 12 * 0.8),
    Math.round(4 + baseScale * 14 * 1.0),
    Math.round(4 + baseScale * 13 * 0.9),
    Math.round(4 + baseScale * 10 * 0.7),
  ]

  return (
    <div className={`flex items-center ${className}`}>
      {state === "idle" && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Inline Voice Dictation (Speech to text into chat)"
          aria-label="Start voice dictation"
        >
          <Mic className="size-3.5" />
        </button>
      )}

      {state === "recording" && (
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 rounded-full bg-rose-950/70 border border-rose-500/40 px-2.5 py-1 text-xs text-rose-200 transition-all hover:bg-rose-900/80 cursor-pointer shadow-lg shadow-rose-950/40 animate-in fade-in zoom-in-95 duration-150"
          title="Stop Dictation (Click to finish)"
          aria-label="Stop audio dictation"
        >
          <span className="relative flex size-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2 bg-rose-500" />
          </span>
          <div className="flex items-center gap-0.5 h-3.5">
            {barHeights.map((h, i) => (
              <span
                key={i}
                className="w-0.5 rounded-full bg-rose-400 transition-all duration-75 ease-out"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          <span className="font-mono text-[10px] text-rose-300 font-semibold tracking-wider">REC</span>
          <Square className="size-2.5 fill-rose-400 text-rose-400 ml-0.5" />
        </button>
      )}

      {state === "transcribing" && (
        <div
          className="flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 text-xs text-amber-200 animate-in fade-in duration-150"
          title="Transcribing local audio with offline STT model..."
        >
          <Loader2 className="size-3 animate-spin text-amber-400" />
          <span className="font-mono text-[10px] text-amber-300 font-medium">Transcribing...</span>
        </div>
      )}

      {state === "inserted" && (
        <div
          className="flex items-center gap-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-200 animate-in fade-in duration-200"
          title="Speech successfully transcribed and inserted into input field"
        >
          <Check className="size-3 text-emerald-400" />
          <span className="font-mono text-[10px] text-emerald-300 font-medium">Inserted</span>
        </div>
      )}

      {state === "error" && (
        <div
          className="flex items-center gap-1.5 rounded-full bg-rose-950/80 border border-rose-600/50 px-2.5 py-1 text-xs text-rose-300 animate-in fade-in duration-150"
          title={errorMessage || "Audio device error"}
        >
          <AlertCircle className="size-3 text-rose-400" />
          <span className="font-mono text-[10px] text-rose-300 font-medium">Mic Error</span>
        </div>
      )}
    </div>
  )
}
