"use client"

import React from "react"
import { Terminal, Sparkles, Code2, GitBranch, Bot, Wrench } from "lucide-react"

interface EmptyHeroStateProps {
  projectName: string
  onSelectPrompt?: (prompt: string) => void
}

export function EmptyHeroState({ projectName, onSelectPrompt }: EmptyHeroStateProps) {
  const suggestions = [
    `Build an autonomous scraping pipeline for ${projectName}`,
    `Run AST safety validation and typecheck across all modules`,
    `Refactor API gateway with graceful shutdown signal traps`,
    `Implement isolated Git worktree for next feature sprint`,
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center select-none animate-in fade-in-50 duration-300">
      {/* Central Floating Agent / Terminal Glyph (Matching Image 2) */}
      <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/40 text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xl font-bold text-zinc-300">{`>_`}</span>
        </div>
      </div>

      {/* Main Headline (Matching Image 2: "What should we build in clash bot engine?") */}
      <h1 className="text-2xl sm:text-3xl font-normal text-zinc-100 tracking-tight max-w-xl">
        What should we build in{" "}
        <span className="underline decoration-zinc-600 underline-offset-4 font-medium text-white">
          {projectName}
        </span>
        ?
      </h1>

      {/* Quick Prompt Suggestions */}
      <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-xl">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt?.(s)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="size-3 text-zinc-500" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
