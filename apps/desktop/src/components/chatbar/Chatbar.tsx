import React from "react"
import { useChatbarState, KryptonChatPayload } from "./useChatbarState"
import { AttachmentTray } from "./AttachmentTray"
import { CommandMenu } from "./CommandMenu"
import { AudioWaveform } from "./AudioWaveform"
import { ModelSelectorPopover } from "./ModelSelectorPopover"
import {
  ArrowUp,
  Globe,
  Paperclip,
  Wrench,
} from "lucide-react"

interface ChatbarProps {
  onSubmit?: (payload: KryptonChatPayload) => void
  className?: string
  placeholder?: string
}

export function Chatbar({
  onSubmit,
  className = "",
  placeholder = "Ask Krypton, type '/' for tools, '@' for context...",
}: ChatbarProps) {
  const {
    prompt,
    stagedContext,
    model,
    setModel,
    enableWebSearch,
    setEnableWebSearch,
    textareaHeight,
    isOverflowing,
    textareaRef,
    handleInputChange,
    handlePaste,
    handleKeyDown,
    removeContextItem,
    activeTrigger,
    filteredCommands,
    selectedIndex,
    commitCommand,
    isRecording,
    audioAmplitude,
    toggleRecording,
    submitTurn,
    setPrompt,
  } = useChatbarState(onSubmit)

  const hasContent = prompt.trim().length > 0 || stagedContext.length > 0

  return (
    <div
      className={`relative w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl backdrop-blur-xl transition-all duration-200 focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-violet-500/30 ${className}`}
    >
      {/* 1. Context & Attachment Tray (Top) */}
      <AttachmentTray items={stagedContext} onRemove={removeContextItem} />

      {/* Autocomplete Menu Popover */}
      {activeTrigger && (
        <CommandMenu
          type={activeTrigger}
          items={filteredCommands}
          selectedIndex={selectedIndex}
          onSelect={commitCommand}
          onClose={() => {}}
        />
      )}

      {/* 2. Text Processing Surface (Middle) */}
      <div className="px-3.5 pt-2.5 pb-1">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{ height: `${textareaHeight}px` }}
          className={`w-full resize-none border-none bg-transparent text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 outline-none focus:ring-0 ${
            isOverflowing ? "overflow-y-auto" : "overflow-y-hidden"
          }`}
        />
      </div>

      {/* 3. Action & Execution Toolbar (Bottom: fixed ~36px) */}
      <div className="flex h-9 items-center justify-between px-3 pb-2 text-xs text-zinc-400">
        {/* Left Toggles */}
        <div className="flex items-center gap-1">
          {/* Quick Context Trigger Button (@) */}
          <button
            type="button"
            onClick={() => {
              setPrompt((prev) => (prev ? prev + " @" : "@"))
              setTimeout(() => textareaRef.current?.focus(), 10)
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Attach Workspace Context (@)"
          >
            <Paperclip className="size-3.5" />
            <span className="font-mono text-[11px]">Context</span>
          </button>

          {/* Quick Tool Trigger Button (/) */}
          <button
            type="button"
            onClick={() => {
              setPrompt((prev) => (prev ? prev + " /" : "/"))
              setTimeout(() => textareaRef.current?.focus(), 10)
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Invoke Tool or Skill (/)"
          >
            <Wrench className="size-3.5" />
            <span className="font-mono text-[11px]">Tools</span>
          </button>

          {/* Web Search Toggle */}
          <button
            type="button"
            onClick={() => setEnableWebSearch(!enableWebSearch)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors cursor-pointer ${
              enableWebSearch
                ? "bg-violet-950/80 text-violet-300 border border-violet-500/40"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            title="Toggle Live Web Search"
          >
            <Globe className="size-3.5" />
            <span className="text-[11px]">Search</span>
          </button>
        </div>

        {/* Right Execution Controls */}
        <div className="flex items-center gap-2">
          {/* Model Selector Popover */}
          <ModelSelectorPopover
            value={model}
            onChange={setModel}
          />

          {/* Real-time Voice Audio Visualizer */}
          <AudioWaveform
            isRecording={isRecording}
            amplitude={audioAmplitude}
            onToggle={toggleRecording}
          />

          {/* Primary Submit Trigger */}
          <button
            type="button"
            onClick={submitTurn}
            disabled={!hasContent}
            className={`flex size-7 items-center justify-center rounded-lg transition-all ${
              hasContent
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 active:translate-y-px cursor-pointer"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
            aria-label="Send prompt or execute turn"
          >
            <ArrowUp className="size-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  )
}
