"use client"

import React, { useState } from "react"
import {
  FileCode2,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Check,
} from "lucide-react"
import { ToolExecutionEvent } from "@/hooks/useAgentSession"

interface ToolExecutionCardProps {
  tool: ToolExecutionEvent
  onReview?: () => void
  onUndo?: () => void
}

export function ToolExecutionCard({ tool, onReview, onUndo }: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)

  const files = tool.files || []
  const initialFiles = files.slice(0, 3)
  const extraFiles = files.slice(3)
  const hasExtra = extraFiles.length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(files, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 flex w-full max-w-2xl flex-col rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4 text-xs text-zinc-300 shadow-lg shadow-black/20 select-none">
      {/* Top Header Row (Matching Image 3) */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        {/* Left: Icon, Title & Diff Counter */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-300">
            <FileCode2 className="size-4" />
          </div>

          <div className="flex flex-col">
            <span className="font-semibold text-sm text-zinc-100">{tool.title}</span>
            {tool.additions !== undefined && tool.deletions !== undefined && (
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-emerald-400 font-medium">+{tool.additions}</span>
                <span className="text-rose-400 font-medium">-{tool.deletions}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Undo & Review Action Buttons */}
        <div className="flex items-center gap-2">
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>Undo</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReview}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-sm transition-colors cursor-pointer"
          >
            <span>Review</span>
          </button>
        </div>
      </div>

      {/* File Diff List (Matching Image 3) */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-3 font-mono text-xs">
          {/* First 3 files */}
          {initialFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-0.5 text-zinc-300 hover:text-white transition-colors"
            >
              <span className="truncate pr-2">{file.path}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-emerald-400">+{file.additions}</span>
                <span className="text-rose-400">-{file.deletions}</span>
              </div>
            </div>
          ))}

          {/* Expanded extra files */}
          {isExpanded &&
            extraFiles.map((file, idx) => (
              <div
                key={`extra-${idx}`}
                className="flex items-center justify-between py-0.5 text-zinc-300 hover:text-white transition-colors"
              >
                <span className="truncate pr-2">{file.path}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-emerald-400">+{file.additions}</span>
                  <span className="text-rose-400">-{file.deletions}</span>
                </div>
              </div>
            ))}

          {/* Show More Files Toggle */}
          {hasExtra && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 mt-1 self-start transition-colors cursor-pointer font-sans"
            >
              <span>{isExpanded ? "Show fewer files" : `Show ${extraFiles.length} more files`}</span>
              {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
        </div>
      )}

      {/* Bottom Micro Toolbar (Matching Image 3: copy, thumbs, share) */}
      <div className="flex items-center gap-3 pt-3 mt-2 border-t border-zinc-800/60 text-zinc-500">
        <button
          type="button"
          onClick={handleCopy}
          className="hover:text-zinc-300 transition-colors"
          title="Copy file list"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setFeedback(feedback === "up" ? null : "up")}
          className={`hover:text-zinc-300 transition-colors ${feedback === "up" ? "text-emerald-400" : ""}`}
          title="Helpful"
        >
          <ThumbsUp className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setFeedback(feedback === "down" ? null : "down")}
          className={`hover:text-zinc-300 transition-colors ${feedback === "down" ? "text-rose-400" : ""}`}
          title="Not helpful"
        >
          <ThumbsDown className="size-3.5" />
        </button>

        <button
          type="button"
          className="hover:text-zinc-300 transition-colors ml-auto"
          title="Share action"
        >
          <Share2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
