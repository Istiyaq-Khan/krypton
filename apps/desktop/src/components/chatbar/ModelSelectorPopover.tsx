"use client"

import * as React from "react"
import {
  Search,
  ChevronDown,
  Check,
  RotateCw,
  Sparkles,
  Cpu,
  Zap,
  X,
  Server,
  Box,
  Layers,
} from "lucide-react"
import { DiscoveredModel } from "@/lib/modelDiscovery"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { cn } from "cn"

export interface ModelSelectorPopoverProps {
  value: string
  onChange: (modelId: string) => void
  availableModels?: DiscoveredModel[]
  onRefresh?: () => Promise<{ success: boolean; models?: DiscoveredModel[]; error?: string }> | void
  isRefreshing?: boolean
  activeProvider?: string
  className?: string
  disabled?: boolean
}

interface ModelFamilyGroup {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  badgeColor: string
  models: DiscoveredModel[]
}

const DEFAULT_FALLBACK_MODELS: DiscoveredModel[] = [
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    description: "Hybrid reasoning & speed flagship",
    contextLength: 200000,
    ownedBy: "anthropic",
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    description: "High-intelligence code & analysis",
    contextLength: 200000,
    ownedBy: "anthropic",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Omni multimodal flagship",
    contextLength: 128000,
    ownedBy: "openai",
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    description: "High-speed STEM reasoning",
    contextLength: 200000,
    ownedBy: "openai",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    description: "Open weights frontier reasoning",
    contextLength: 128000,
    ownedBy: "deepseek",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Massive context reasoning model",
    contextLength: 1000000,
    ownedBy: "google",
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    description: "Local open-weights intelligence",
    contextLength: 128000,
    ownedBy: "meta",
  },
]

function getFamilyForModel(model: DiscoveredModel): {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  badgeColor: string
} {
  const idLower = (model.id || "").toLowerCase()
  const nameLower = (model.name || "").toLowerCase()
  const ownerLower = (model.ownedBy || "").toLowerCase()

  if (
    idLower.includes("claude") ||
    nameLower.includes("claude") ||
    ownerLower.includes("anthropic")
  ) {
    return {
      id: "anthropic",
      name: "Anthropic / Claude",
      icon: Sparkles,
      badgeColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    }
  }

  if (
    idLower.includes("gpt") ||
    idLower.includes("o1") ||
    idLower.includes("o3") ||
    nameLower.includes("gpt") ||
    ownerLower.includes("openai")
  ) {
    return {
      id: "openai",
      name: "OpenAI / Reasoning",
      icon: Zap,
      badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    }
  }

  if (
    idLower.includes("deepseek") ||
    nameLower.includes("deepseek") ||
    ownerLower.includes("deepseek")
  ) {
    return {
      id: "deepseek",
      name: "DeepSeek",
      icon: Cpu,
      badgeColor: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
    }
  }

  if (
    idLower.includes("gemini") ||
    nameLower.includes("gemini") ||
    ownerLower.includes("google")
  ) {
    return {
      id: "google",
      name: "Google / Gemini",
      icon: Layers,
      badgeColor: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    }
  }

  if (
    idLower.includes("llama") ||
    nameLower.includes("llama") ||
    ownerLower.includes("meta")
  ) {
    return {
      id: "meta",
      name: "Meta / Llama",
      icon: Box,
      badgeColor: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    }
  }

  if (
    idLower.includes("qwen") ||
    idLower.includes("mistral") ||
    idLower.includes("phi") ||
    idLower.includes("local") ||
    ownerLower.includes("ollama")
  ) {
    return {
      id: "local",
      name: "Local / Ollama",
      icon: Server,
      badgeColor: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    }
  }

  return {
    id: "other",
    name: "Other Models",
    icon: Cpu,
    badgeColor: "text-zinc-400 bg-zinc-800/40 border-zinc-700/40",
  }
}

function formatContextLength(tokens?: number): string | null {
  if (!tokens || tokens <= 0) return null
  if (tokens >= 1000000) {
    const m = tokens / 1000000
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}k`
  }
  return `${tokens}`
}

export function ModelSelectorPopover({
  value,
  onChange,
  availableModels = [],
  onRefresh,
  isRefreshing = false,
  activeProvider,
  className,
  disabled = false,
}: ModelSelectorPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Auto-focus search input when popover opens
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Compute full model catalog
  const effectiveModels = React.useMemo(() => {
    const rawList = availableModels.length > 0 ? availableModels : DEFAULT_FALLBACK_MODELS
    const hasActive = rawList.some((m) => m.id === value)

    if (!hasActive && value) {
      return [{ id: value, name: value, description: "Active selection" }, ...rawList]
    }
    return rawList
  }, [availableModels, value])

  // Filter models based on search query
  const filteredModels = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return effectiveModels

    return effectiveModels.filter((m) => {
      const idMatch = (m.id || "").toLowerCase().includes(q)
      const nameMatch = (m.name || "").toLowerCase().includes(q)
      const descMatch = (m.description || "").toLowerCase().includes(q)
      const ownerMatch = (m.ownedBy || "").toLowerCase().includes(q)
      return idMatch || nameMatch || descMatch || ownerMatch
    })
  }, [effectiveModels, searchQuery])

  // Group filtered models into families
  const groupedFamilies = React.useMemo(() => {
    const groupsMap = new Map<string, ModelFamilyGroup>()

    for (const model of filteredModels) {
      const fam = getFamilyForModel(model)
      if (!groupsMap.has(fam.id)) {
        groupsMap.set(fam.id, {
          id: fam.id,
          name: fam.name,
          icon: fam.icon,
          badgeColor: fam.badgeColor,
          models: [],
        })
      }
      groupsMap.get(fam.id)!.models.push(model)
    }

    return Array.from(groupsMap.values())
  }, [filteredModels])

  // Get active model display name & family
  const activeModelObj = React.useMemo(() => {
    return effectiveModels.find((m) => m.id === value) || { id: value, name: value }
  }, [effectiveModels, value])

  const activeFamily = React.useMemo(() => {
    return getFamilyForModel(activeModelObj)
  }, [activeModelObj])

  const ActiveIcon = activeFamily.icon

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearchQuery("")
    }
  }

  const handleSelect = (modelId: string) => {
    onChange(modelId)
    setSearchQuery("")
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleOpenChange(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "group flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/70 hover:bg-zinc-900/90 hover:border-zinc-700/80 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-all outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none",
          open && "border-zinc-700 bg-zinc-900 ring-1 ring-violet-500/40",
          className
        )}
        title="Select AI Reasoning Model"
      >
        <ActiveIcon className="size-3 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
        <span className="max-w-[140px] truncate text-zinc-200 font-medium tracking-tight">
          {activeModelObj.name || activeModelObj.id || "Select Model"}
        </span>
        <ChevronDown
          className={cn(
            "size-3 text-zinc-500 transition-transform duration-200 shrink-0",
            open && "rotate-180 text-zinc-300"
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-[340px] rounded-xl border border-zinc-800/90 bg-zinc-950/95 p-0 text-zinc-100 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5 outline-none overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header & Search Bar */}
        <div className="border-b border-zinc-800/80 p-2.5 pb-2 bg-zinc-900/40">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-zinc-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models or providers..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-violet-500/30 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  searchInputRef.current?.focus()
                }}
                className="absolute right-2 text-zinc-400 hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Model Families Container with Dark Scrollbars */}
        <div className="max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 space-y-3">
          {groupedFamilies.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              No models matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            groupedFamilies.map((group) => {
              const GroupIcon = group.icon
              return (
                <div key={group.id} className="space-y-1">
                  {/* Family Group Header */}
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 select-none">
                    <div className="flex items-center gap-1.5">
                      <GroupIcon className="size-3 text-zinc-400" />
                      <span>{group.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-1.5 py-0.2 rounded border border-zinc-800/60">
                      {group.models.length}
                    </span>
                  </div>

                  {/* Model List Items */}
                  <div className="space-y-0.5">
                    {group.models.map((m) => {
                      const isSelected = m.id === value
                      const contextBadge = formatContextLength(m.contextLength)

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelect(m.id)}
                          className={cn(
                            "group/item flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-all cursor-pointer select-none",
                            isSelected
                              ? "bg-violet-600/15 border border-violet-500/30 text-white font-medium shadow-xs"
                              : "border border-transparent text-zinc-300 hover:bg-zinc-900/80 hover:text-zinc-100"
                          )}
                        >
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate font-medium text-xs">
                                {m.name && m.name !== m.id ? m.name : m.id}
                              </span>
                              {contextBadge && (
                                <span className="shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono font-normal tracking-tight bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                                  {contextBadge}
                                </span>
                              )}
                            </div>
                            {m.description && (
                              <span className="truncate text-[10px] text-zinc-500 group-hover/item:text-zinc-400">
                                {m.description}
                              </span>
                            )}
                          </div>

                          {/* Selected Checkmark */}
                          {isSelected && (
                            <Check className="size-3.5 text-violet-400 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Popover Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-900/40 px-2.5 py-1.5 text-[11px] text-zinc-400 select-none">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500/80" />
            <span className="text-[10px] text-zinc-400">
              {activeProvider ? `Provider: ${activeProvider}` : `${effectiveModels.length} models available`}
            </span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                await onRefresh()
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
              title="Refresh models from provider"
            >
              <RotateCw
                className={cn(
                  "size-2.5",
                  isRefreshing && "animate-spin text-violet-400"
                )}
              />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
