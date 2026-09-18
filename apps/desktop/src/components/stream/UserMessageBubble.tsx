"use client"

import React, { useState } from "react"
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"

interface UserMessageBubbleProps {
  prompt: string
  codeSnippet?: string
}

export function UserMessageBubble({ prompt, codeSnippet }: UserMessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isLong = prompt.length > 280
  const displayedText = isLong && !isExpanded ? prompt.slice(0, 260) + "..." : prompt

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex justify-end w-full my-4">
      <div className="flex flex-col max-w-2xl rounded-2xl border border-blue-900/60 bg-[#0f172a] p-4 text-xs leading-relaxed text-blue-50 shadow-xl shadow-blue-950/20">
        {/* User Prompt Text */}
        <div className="whitespace-pre-wrap font-sans text-sm text-zinc-100 leading-relaxed break-words">
          {displayedText}
        </div>

        {/* Show More toggle for very long prompts */}
        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium mt-2 pt-1 border-t border-blue-900/40 self-start transition-colors"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                <span>Show more</span>
                <ChevronDown className="size-3" />
              </>
            )}
          </button>
        )}

        {/* Optional Attached Code / Command Snippet */}
        {codeSnippet && (
          <div className="mt-3 rounded-lg border border-blue-900/40 bg-slate-950/80 p-2.5 font-mono text-xs text-blue-200 overflow-x-auto">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 border-b border-zinc-900 pb-1">
              <span>Attached Command / Context</span>
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-zinc-300 flex items-center gap-1"
              >
                {copied ? <Check className="size-2.5 text-emerald-400" /> : <Copy className="size-2.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <code>{codeSnippet}</code>
          </div>
        )}
      </div>
    </div>
  )
}
