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
  const recognitionRef = useRef<any>(null)

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
        console.warn("Tauri audio capture start:", err)
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
        analyser.fftSize = 64
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

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
      }

      // Real speech recognition
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

        recognition.onerror = () => {
          // ignore or fallback
        }

        recognition.start()
        recognitionRef.current = recognition
      }
    } catch (err) {
      console.warn("Microphone access notice:", err)
      setTranscription("Microphone hardware unavailable")
    }
  }, [])

  const stopRecording = useCallback(async () => {
    setIsRecording(false)
    setStatusPill("Transcribing...")

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    setAmplitude(0)

    // Call Tauri command if inside Tauri
    if (typeof window !== "undefined" && isTauri()) {
      try {
        const result = await invoke<{ transcript: string; is_final: boolean }>("stop_audio_capture")
        if (result.transcript && !transcription) {
          setTranscription(result.transcript)
        }
      } catch (err) {
        console.warn("Tauri audio capture stop:", err)
      }
    }

    setIsFinal(true)
    setStatusPill("Dispatched")

    if (onDispatchPrompt && transcription.trim()) {
      onDispatchPrompt(transcription.trim(), targetAgent)
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
