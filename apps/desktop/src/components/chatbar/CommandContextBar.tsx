"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  Folder,
  Monitor,
  GitBranch,
  Plus,
  Clock,
  Mic,
  ArrowUp,
  ChevronDown,
  Paperclip,
  Check,
} from "lucide-react"

interface CommandContextBarProps {
  projectName: string
  branchName: string
  isLocal: boolean
  model: string
  onModelChange: (model: string) => void
  askForApproval: boolean
  onToggleApproval: () => void
  onSubmitPrompt: (prompt: string) => void
  onVoiceTrigger?: () => void
}

export function CommandContextBar({
  projectName,
  branchName,
  isLocal = true,
  model,
  onModelChange,
  askForApproval,
  onToggleApproval,
  onSubmitPrompt,
  onVoiceTrigger,
}: CommandContextBarProps) {
  const [prompt, setPrompt] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (prompt.trim()) {
        onSubmitPrompt(prompt)
        setPrompt("")
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
        }
      }
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmitPrompt(prompt)
      setPrompt("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-2 p-3 select-none">
      {/* 1. Context Chips (Matching Images 2 & 3: [folder] [Local] [branch]) */}
      <div className="flex items-center gap-2 text-xs text-zinc-400 font-sans px-1">
        {/* Project Tag */}
        <div className="flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-zinc-800/80 transition-colors cursor-pointer text-zinc-300">
          <Folder className="size-3.5 text-zinc-400" />
          <span className="font-medium text-[11px]">{projectName || "No Workspace"}</span>
        </div>

        {/* Local Machine Tag */}
        <div className="flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-zinc-800/80 transition-colors cursor-pointer text-zinc-300">
          <Monitor className="size-3.5 text-zinc-400" />
          <span className="font-medium text-[11px]">Local</span>
        </div>

        {/* Git Branch Tag */}
        {branchName && (
          <div className="flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-zinc-800/80 transition-colors cursor-pointer text-zinc-300">
            <GitBranch className="size-3.5 text-zinc-400" />
            <span className="font-mono text-[11px] truncate max-w-[180px]">{branchName}</span>
          </div>
        )}
      </div>

      {/* 2. Main Unified Command Box Container (Matching Target Images) */}
      <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-xl focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
        {/* Text Input Area */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Do anything"
            className="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 outline-none focus:ring-0 max-h-44 overflow-y-auto"
          />
        </div>

        {/* Action Row (Matching Images 2, 3, 4) */}
        <div className="flex items-center justify-between px-3 pb-2 pt-1 text-xs text-zinc-400">
          {/* Left Controls: (+) Add context and (⏱ Ask for approval) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Add Context or Attach File (+)"
            >
              <Plus className="size-4" />
            </button>

            {/* Ask for Approval Toggle Button */}
            <button
              type="button"
              onClick={onToggleApproval}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                askForApproval
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/40"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent"
              }`}
              title="Toggle Human-in-the-Loop approval gate for tool executions"
            >
              <Clock className="size-3.5" />
              <span>Ask for approval</span>
              {askForApproval && <Check className="size-3 text-blue-400" />}
            </button>
          </div>

          {/* Right Controls: Model Selector, Mic, Send */}
          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            <div className="relative">
              <select
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="appearance-none rounded-lg border border-transparent bg-transparent hover:bg-zinc-800 px-2.5 py-1 pr-6 text-[11px] font-medium text-zinc-300 outline-none cursor-pointer transition-colors"
              >
                <option value="5.6 Terra High" className="bg-zinc-900 text-zinc-200">
                  5.6 Terra High
                </option>
                <option value="Claude 3.7 Sonnet" className="bg-zinc-900 text-zinc-200">
                  Claude 3.7 Sonnet
                </option>
                <option value="GPT-4o" className="bg-zinc-900 text-zinc-200">
                  GPT-4o
                </option>
                <option value="DeepSeek R1" className="bg-zinc-900 text-zinc-200">
                  DeepSeek R1
                </option>
                <option value="Local Llama 3.3" className="bg-zinc-900 text-zinc-200">
                  Local Llama 3.3
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-zinc-500" />
            </div>

            {/* Microphone Button */}
            <button
              type="button"
              onClick={onVoiceTrigger}
              className="flex size-7 items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Voice Input (or open Voice HUD)"
            >
              <Mic className="size-3.5" />
            </button>

            {/* Send / Dispatch Up-Arrow Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className={`flex size-7 items-center justify-center rounded-full transition-all ${
                prompt.trim()
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 cursor-pointer"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
              title="Dispatch Prompt (Enter)"
            >
              <ArrowUp className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
