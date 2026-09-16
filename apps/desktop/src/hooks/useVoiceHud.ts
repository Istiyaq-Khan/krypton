import { useState, useRef, useCallback } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"

export interface VoiceHudState {
  isRecording: boolean
  amplitude: number
  targetAgent: string
  transcription: string
  isFinal: boolean
  statusPill: string
}

export function useVoiceHud(onDispatchPrompt?: (text: string, targetAgent: string) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const [amplitude, setAmplitude] = useState(0)
  const [targetAgent, setTargetAgent] = useState("Orchestrator")
  const [transcription, setTranscription] = useState("")
  const [isFinal, setIsFinal] = useState(false)
  const [statusPill, setStatusPill] = useState("Ready")

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const startRecording = useCallback(async () => {
    setIsRecording(true)
    setIsFinal(false)
    setStatusPill("Listening...")
    setTranscription("")

    // Call Tauri command if inside Tauri
    if (typeof window !== "undefined" && isTauri()) {
      try {
        await invoke("start_audio_capture", { provider: "parakeet_v3" })
      } catch (err) {
        console.warn("Tauri audio capture start failed:", err)
      }
    }

    // Stream audio via Web Audio API for waveform animation
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new AudioContextClass()
        audioContextRef.current = ctx

        const analyser = ctx.createAnalyser()
        analyser.fftSize = 32
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        // Mock transcription typewriter simulation while user speaks
        let mockWords = ["Create", "an", "isolated", "worktree", "and", "verify", "security", "linter"]
        let wordIdx = 0
        const interval = setInterval(() => {
          if (wordIdx < mockWords.length) {
            setTranscription((prev) => (prev ? `${prev} ${mockWords[wordIdx]}` : mockWords[wordIdx]))
            wordIdx++
          }
        }, 400)

        const updateVolume = () => {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const avg = sum / dataArray.length
          setAmplitude(Math.min(1, avg / 128))
          animFrameRef.current = requestAnimationFrame(updateVolume)
        }

        updateVolume()
        return () => clearInterval(interval)
      }
    } catch (err) {
      console.warn("Microphone access failed:", err)
      setTranscription("Microphone hardware unavailable")
    }
  }, [])

  const stopRecording = useCallback(async () => {
    setIsRecording(false)
    setStatusPill("Transcribing...")

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }

    setAmplitude(0)

    // Call Tauri command if inside Tauri
    if (typeof window !== "undefined" && isTauri()) {
      try {
        const result = await invoke<{ transcript: string; is_final: boolean }>("stop_audio_capture")
        if (result.transcript) {
          setTranscription(result.transcript)
        }
      } catch (err) {
        console.warn("Tauri audio capture stop failed:", err)
      }
    }

    setIsFinal(true)
    setStatusPill("Dispatched")

    if (onDispatchPrompt && transcription) {
      onDispatchPrompt(transcription, targetAgent)
    }
  }, [onDispatchPrompt, transcription, targetAgent])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  return {
    isRecording,
    amplitude,
    targetAgent,
    setTargetAgent,
    transcription,
    setTranscription,
    isFinal,
    statusPill,
    toggleRecording,
    startRecording,
    stopRecording,
  }
}
