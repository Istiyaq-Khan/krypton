"use client"

import React, { useState, useRef } from "react"
import {
  Folder,
  Monitor,
  GitBranch,
  Plus,
  Clock,
  ArrowUp,
  Check,
  RotateCw,
  AlertCircle,
} from "lucide-react"
import { DiscoveredModel } from "@/lib/modelDiscovery"
import { ModelSelectorPopover } from "./ModelSelectorPopover"
import { InlineVoiceRecorder } from "./InlineVoiceRecorder"

interface CommandContextBarProps {
  projectName: string
  branchName: string
  isLocal: boolean
  model: string
  onModelChange: (model: string) => void
  availableModels?: DiscoveredModel[]
  onRefreshModels?: () => Promise<{ success: boolean; models?: DiscoveredModel[]; error?: string }>
  isRefreshingModels?: boolean
  activeProvider?: string
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
  availableModels = [],
  onRefreshModels,
  isRefreshingModels = false,
  activeProvider,
  askForApproval,
  onToggleApproval,
  onSubmitPrompt,
  onVoiceTrigger,
}: CommandContextBarProps) {
  const [prompt, setPrompt] = useState("")
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const basePromptRef = useRef("")

  const handleStartDictation = () => {
    basePromptRef.current = prompt
  }

  const handleTranscriptionChange = (text: string, isFinal: boolean) => {
    const base = basePromptRef.current
    let nextPrompt = ""
    if (base && base.trim().length > 0) {
      nextPrompt = `${base.trimEnd()} ${text}`
    } else {
      nextPrompt = text
    }
    setPrompt(nextPrompt)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
      if (isFinal) {
        textareaRef.current.focus()
      }
    }

    if (isFinal) {
      basePromptRef.current = ""
    }
  }

  const handleConfirmRefresh = async () => {
    setShowRefreshConfirm(false)
    if (onRefreshModels) {
      const res = await onRefreshModels()
      if (res.success && res.models) {
        setFeedbackBanner({
          type: "success",
          text: `Refreshed ${res.models.length} models from ${activeProvider || "provider"}.`,
        })
      } else {
        setFeedbackBanner({
          type: "error",
          text: res.error || "Failed to refresh models from endpoint.",
        })
      }
      setTimeout(() => setFeedbackBanner(null), 4000)
    }
  }

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
          <span className="font-medium text-[11px]">{isLocal ? "Local" : "Remote"}</span>
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

          {/* Right Controls: Model Selector with In-App Refresh, Mic, Send */}
          <div className="flex items-center gap-1.5">
            {/* Accessible Model Selector Popover */}
            <ModelSelectorPopover
              value={model}
              onChange={onModelChange}
              availableModels={availableModels}
              onRefresh={() => setShowRefreshConfirm(true)}
              isRefreshing={isRefreshingModels}
              activeProvider={activeProvider}
            />

            {/* Inline Voice Dictation */}
            <InlineVoiceRecorder
              onTranscriptionChange={handleTranscriptionChange}
              onStartRecording={handleStartDictation}
            />

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

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs animate-in fade-in-50 ${
            feedbackBanner.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
              : "border-rose-800/80 bg-rose-950/40 text-rose-300"
          }`}
        >
          {feedbackBanner.type === "success" ? (
            <Check className="size-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="size-3.5 text-rose-400 shrink-0" />
          )}
          <span>{feedbackBanner.text}</span>
        </div>
      )}

      {/* Confirmation Modal for Refresh Models */}
      {showRefreshConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2.5 text-zinc-100 mb-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
                <RotateCw className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Refresh Available Models?</h3>
                <p className="text-[11px] text-zinc-400">Query active provider endpoint</p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed my-3">
              This will connect to your configured <span className="font-semibold text-zinc-200 capitalize">{activeProvider || "AI"}</span> endpoint to discover the latest model list and update your local cache.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowRefreshConfirm(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefresh}
                className="rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCw className="size-3" />
                <span>Confirm & Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
