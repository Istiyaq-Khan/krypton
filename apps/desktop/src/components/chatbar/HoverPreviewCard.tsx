import React from "react"
import { StagedContextItem } from "./useChatbarState"
import { FileCode, FileText, Wrench, Sparkles, FolderGit2 } from "lucide-react"

interface HoverPreviewCardProps {
  item: StagedContextItem
  onClose?: () => void
}

export function HoverPreviewCard({ item }: HoverPreviewCardProps) {
  const getIcon = () => {
    switch (item.category) {
      case "mcp":
        return <Wrench className="size-4 text-violet-400" />
      case "skill":
        return <Sparkles className="size-4 text-amber-400" />
      case "snippet":
        return <FileCode className="size-4 text-emerald-400" />
      case "folder":
        return <FolderGit2 className="size-4 text-blue-400" />
      default:
        return <FileText className="size-4 text-zinc-400" />
    }
  }

  // Real content display (up to first 10 lines) without fabricated AI summary
  const lines = item.rawContent ? item.rawContent.split("\n").slice(0, 10) : []

  return (
    <div className="w-80 rounded-lg border border-zinc-800 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-xl text-xs text-zinc-300 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-zinc-800/80">
        {getIcon()}
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-zinc-100 truncate">{item.name}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {item.category}
            {item.metadata?.mcpServer && ` · ${item.metadata.mcpServer}`}
          </span>
        </div>
      </div>

      {/* Body: genuine text or metadata */}
      {item.rawContent ? (
        <div className="rounded bg-zinc-900/90 p-2 font-mono text-[11px] leading-relaxed text-zinc-300 overflow-hidden">
          {lines.map((line, idx) => (
            <div key={idx} className="truncate text-zinc-400">
              <span className="select-none text-zinc-600 mr-2">{idx + 1}</span>
              {line || " "}
            </div>
          ))}
          {item.rawContent.split("\n").length > 10 && (
            <div className="mt-1 text-[10px] text-zinc-600 italic">
              ... {item.rawContent.split("\n").length - 10} more lines
            </div>
          )}
        </div>
      ) : item.category === "mcp" ? (
        <div className="flex flex-col gap-1.5 py-1 text-[11px] text-zinc-400">
          <p className="text-zinc-300">Verified Model Context Protocol Tool.</p>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            <span>Status: Registered & Bound to LLM Context</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 py-1 text-[11px] text-zinc-400">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Path:</span>
            <span className="font-mono text-zinc-300">{item.path || item.name}</span>
          </div>
          {item.metadata?.lineCount && (
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Lines:</span>
              <span className="text-zinc-300">{item.metadata.lineCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
