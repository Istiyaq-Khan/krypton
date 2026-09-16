import React, { useState, useEffect } from "react"
import { HelpCircle, Send, X, CornerDownLeft } from "lucide-react"

export interface ChoiceOption {
  id: string
  label: string
  description?: string
  hotkeyHint?: string
}

export interface ClarificationRequestData {
  id: string
  agentId: string
  agentName?: string
  prompt: string
  options?: ChoiceOption[]
  allowFreeform?: boolean
  timeoutMs?: number
}

interface QuestionModalProps {
  request: ClarificationRequestData | null
  isOpen: boolean
  onResolve: (response: { selectedOptionIds: string[]; freeformText?: string }) => void
  onDismiss: () => void
}

export function QuestionModal({
  request,
  isOpen,
  onResolve,
  onDismiss,
}: QuestionModalProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [freeformText, setFreeformText] = useState("")

  useEffect(() => {
    if (request?.options && request.options.length > 0) {
      setSelectedOptionId(request.options[0].id)
    } else {
      setSelectedOptionId(null)
    }
    setFreeformText("")
  }, [request])

  // Keyboard navigation & number shortcuts (1..9)
  useEffect(() => {
    if (!isOpen || !request) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Number hotkeys for choices
      if (request.options && request.options.length > 0) {
        const num = parseInt(e.key)
        if (!isNaN(num) && num >= 1 && num <= request.options.length) {
          e.preventDefault()
          setSelectedOptionId(request.options[num - 1].id)
          return
        }

        if (e.key === "ArrowDown") {
          e.preventDefault()
          const currIdx = request.options.findIndex((o) => o.id === selectedOptionId)
          const nextIdx = (currIdx + 1) % request.options.length
          setSelectedOptionId(request.options[nextIdx].id)
          return
        }

        if (e.key === "ArrowUp") {
          e.preventDefault()
          const currIdx = request.options.findIndex((o) => o.id === selectedOptionId)
          const prevIdx = (currIdx - 1 + request.options.length) % request.options.length
          setSelectedOptionId(request.options[prevIdx].id)
          return
        }
      }

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !request.allowFreeform)) {
        e.preventDefault()
        handleSubmit()
      }

      if (e.key === "Escape") {
        e.preventDefault()
        onDismiss()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, request, selectedOptionId, freeformText])

  if (!isOpen || !request) return null

  const handleSubmit = () => {
    onResolve({
      selectedOptionIds: selectedOptionId ? [selectedOptionId] : [],
      freeformText: freeformText.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in-0 duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-4 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                Human-in-the-Loop Clarification
              </h2>
              <span className="text-[11px] font-mono text-zinc-500">
                Agent: [{request.agentName || request.agentId.slice(0, 8)}]
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Prompt */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
          <p className="text-sm leading-relaxed text-zinc-200 font-medium">
            {request.prompt}
          </p>
        </div>

        {/* Structured Options */}
        {request.options && request.options.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Select an option (or press 1..{request.options.length}):
            </span>
            <div className="flex flex-col gap-1.5">
              {request.options.map((opt, idx) => {
                const isSelected = opt.id === selectedOptionId
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-violet-500 bg-violet-950/30 text-white shadow-md shadow-violet-950/40"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-5 items-center justify-center rounded-md bg-zinc-800 font-mono text-[11px] text-zinc-300">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="text-xs text-zinc-400">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="size-2 rounded-full bg-violet-400" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Freeform input */}
        {request.allowFreeform !== false && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="freeform-input"
              className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
            >
              Additional Custom Instructions (optional):
            </label>
            <textarea
              id="freeform-input"
              value={freeformText}
              onChange={(e) => setFreeformText(e.target.value)}
              placeholder="Provide clarifying instructions or type specific guidance..."
              rows={2}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-200 placeholder-zinc-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-[11px] text-zinc-500 font-mono">
            Press Enter to Confirm · Esc to Dismiss
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-all cursor-pointer"
            >
              <span>Submit Resolution</span>
              <CornerDownLeft className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
