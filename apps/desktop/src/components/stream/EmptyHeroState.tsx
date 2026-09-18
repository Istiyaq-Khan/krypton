"use client"

import React from "react"
import { Sparkles, FolderPlus, FolderOpen, Terminal } from "lucide-react"

interface EmptyHeroStateProps {
  projectName?: string
  onSelectPrompt?: (prompt: string) => void
  onCreateProject?: () => void
}

export function EmptyHeroState({
  projectName,
  onSelectPrompt,
  onCreateProject,
}: EmptyHeroStateProps) {
  const isUninitialized = !projectName || projectName.trim() === ""

  const suggestions = [
    `Inspect workspace & verify AST safety boundaries`,
    `Analyze repository structure and dependencies`,
    `Synthesize feature execution plan in isolated worktree`,
    `Run test suite and verify type safety`,
  ]

  if (isUninitialized) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center select-none animate-in fade-in-50 duration-300">
        <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/60 text-zinc-400">
          <Terminal className="size-8 text-violet-400" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight max-w-md">
          No Workspace Open
        </h1>
        <p className="mt-2.5 max-w-sm text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Create or open a local project workspace to delegate autonomous coding tasks and supervise agent DAGs.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onCreateProject}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-violet-900/30 transition-all cursor-pointer"
          >
            <FolderPlus className="size-4" />
            <span>New Workspace</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center select-none animate-in fade-in-50 duration-300">
      <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/40 text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xl font-bold text-zinc-300">{`>_`}</span>
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-normal text-zinc-100 tracking-tight max-w-xl">
        What should we build in{" "}
        <span className="underline decoration-zinc-600 underline-offset-4 font-medium text-white">
          {projectName}
        </span>
        ?
      </h1>

      {/* Quick Functional Prompt Suggestions */}
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

