"use client"

import React, { useState } from "react"
import { X, Sparkles, Bot, Cpu, ShieldCheck, Terminal, HardDrive, Globe, Flame } from "lucide-react"
import { DiscoveredModel, isTemperatureSupported } from "@/lib/modelDiscovery"
import { createAgentIpc } from "@/lib/agentIpc"
import { AgentFleetItem } from "@/lib/persistence"

export interface CreateAgentModalProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agent: AgentFleetItem) => void
  availableModels?: DiscoveredModel[]
}

export function CreateAgentModal({
  isOpen,
  onClose,
  onAgentCreated,
  availableModels = [],
}: CreateAgentModalProps) {
  const [name, setName] = useState("")
  const [model, setModel] = useState("5.6 Terra High")
  const [provider, setProvider] = useState("anthropic")
  const [temperature, setTemperature] = useState(0.2)
  const [identityPrompt, setIdentityPrompt] = useState("")
  const [tools, setTools] = useState({
    terminal: true,
    filesystem: true,
    astLinter: true,
    web: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const selectedModelMeta = availableModels.find(
    (m) => m.id.toLowerCase() === model.toLowerCase() || m.name?.toLowerCase() === model.toLowerCase()
  )
  const supportsTemp = isTemperatureSupported(model, selectedModelMeta)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Agent name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const created = await createAgentIpc({
        name: trimmedName,
        model: model.trim() || "5.6 Terra High",
        provider,
        temperature: supportsTemp ? temperature : 1.0,
        permissions: tools,
        identityPrompt: identityPrompt.trim(),
      })

      onAgentCreated(created)
      setName("")
      setIdentityPrompt("")
      onClose()
    } catch (err: any) {
      setError(err?.message || "Failed to provision agent workspace")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 shadow-2xl shadow-violet-950/20 space-y-5 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-agent-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 id="create-agent-modal-title" className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Provision Autonomous Agent</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Initializes <code className="font-mono text-zinc-300">~/.krypton/agents/&lt;name&gt;/</code> with <code className="font-mono text-zinc-300">config.json</code> and template <code className="font-mono text-zinc-300">IDENTITY.md</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3.5 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Agent Name */}
          <div>
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Bot className="size-3.5 text-violet-400" />
              <span>Agent Name *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ScraperBot, DocsWriter, KernelDev"
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500 transition-colors"
              required
              autoFocus
            />
          </div>

          {/* Model & Temperature */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Cpu className="size-3.5 text-violet-400" />
                <span>Target Model</span>
              </label>
              <input
                type="text"
                list="discovered-models-list"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Claude 3.7 Sonnet, o3-mini"
                className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500 transition-colors"
              />
              <datalist id="discovered-models-list">
                {availableModels.map((m) => (
                  <option key={m.id} value={m.name || m.id} />
                ))}
              </datalist>
            </div>

            {/* Dynamically toggled Temperature slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Flame className="size-3.5 text-violet-400" />
                  <span>Temperature</span>
                </span>
                {supportsTemp ? (
                  <span className="font-mono text-zinc-400 text-[11px]">{temperature}</span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    Disabled (Reasoning)
                  </span>
                )}
              </div>

              {supportsTemp ? (
                <div className="mt-2.5">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>Precise (0.0)</span>
                    <span>Balanced (0.2)</span>
                    <span>Creative (1.0)</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-950/20 px-2.5 py-2 text-[11px] text-amber-300/80 leading-snug">
                  Temperature tuning is not supported for reasoning models like <span className="font-mono text-amber-200">{model}</span>. Fixed to default.
                </div>
              )}
            </div>
          </div>

          {/* AGENTS.md Role Architecture Notice */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 flex items-start gap-2.5 text-zinc-400">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-zinc-200">Role & Workspace Conventions: </span>
              In accordance with Krypton protocol, agent roles and operational boundaries are governed declaratively by <code className="text-zinc-300 font-mono">AGENTS.md</code> rather than manual UI textfields.
            </div>
          </div>

          {/* Tools Selection */}
          <div>
            <label className="text-xs font-medium text-zinc-300">Tool Manifest Permissions</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                { id: "terminal", label: "Terminal Execution", icon: Terminal, desc: "CLI commands & unit tests" },
                { id: "filesystem", label: "Filesystem Access", icon: HardDrive, desc: "Read & write project code" },
                { id: "astLinter", label: "AST Safety Check", icon: ShieldCheck, desc: "Enforce static safety guards" },
                { id: "web", label: "Stealth Browser", icon: Globe, desc: "AXTree headless navigation" },
              ].map((t) => {
                const Icon = t.icon
                const isChecked = (tools as any)[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTools((prev) => ({ ...prev, [t.id]: !(prev as any)[t.id] }))}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      isChecked
                        ? "border-violet-500/40 bg-violet-950/20 text-zinc-200"
                        : "border-zinc-800/70 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700"
                    }`}
                  >
                    <Icon className={`size-3.5 mt-0.5 ${isChecked ? "text-violet-400" : "text-zinc-500"}`} />
                    <div>
                      <div className="text-xs font-medium">{t.label}</div>
                      <div className="text-[10px] text-zinc-500">{t.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Template IDENTITY.md */}
          <div>
            <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
              <span>Template Persona & System Directives (saved to IDENTITY.md)</span>
              <span className="text-[10px] text-zinc-500 font-mono">Optional</span>
            </label>
            <textarea
              rows={3}
              value={identityPrompt}
              onChange={(e) => setIdentityPrompt(e.target.value)}
              placeholder="e.g. You are an expert TypeScript engineer specialized in AST linters and Vitest integration..."
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500 resize-none font-mono transition-colors"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Sparkles className="size-3.5" />
              <span>{isSubmitting ? "Provisioning..." : "Initialize Agent Workspace"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
