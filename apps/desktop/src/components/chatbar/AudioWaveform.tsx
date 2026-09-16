import React from "react"
import { Mic, MicOff, Square } from "lucide-react"

interface AudioWaveformProps {
  isRecording: boolean
  amplitude: number
  onToggle: () => void
}

export function AudioWaveform({
  isRecording,
  amplitude,
  onToggle,
}: AudioWaveformProps) {
  if (!isRecording) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
        title="Voice Input (Push to Talk)"
        aria-label="Start audio recording"
      >
        <Mic className="size-4" />
      </button>
    )
  }

  // 4 reactive bars scaling between 4px and 20px
  const baseScale = Math.max(0.15, amplitude)
  const barHeights = [
    Math.round(4 + baseScale * 14 * 0.8),
    Math.round(4 + baseScale * 16 * 1.0),
    Math.round(4 + baseScale * 15 * 0.9),
    Math.round(4 + baseScale * 12 * 0.7),
  ]

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-full bg-violet-950/70 border border-violet-500/40 px-2.5 py-1 text-xs text-violet-200 transition-all hover:bg-violet-900/80 cursor-pointer animate-pulse"
      title="Stop Audio Recording"
      aria-label="Stop audio recording"
    >
      <div className="flex items-center gap-0.5 h-5">
        {barHeights.map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-violet-400 transition-all duration-75 ease-out"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] text-violet-300 ml-1">REC</span>
      <Square className="size-2.5 fill-violet-400 text-violet-400 ml-0.5" />
    </button>
  )
}
