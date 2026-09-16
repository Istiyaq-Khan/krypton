import React, { useState, useRef } from "react"
import { StagedContextItem } from "./useChatbarState"
import { HoverPreviewCard } from "./HoverPreviewCard"
import { FileCode, FileText, Wrench, Sparkles, FolderGit2, X } from "lucide-react"

interface AttachmentTrayProps {
  items: StagedContextItem[]
  onRemove: (id: string) => void
}

export function AttachmentTray({ items, onRemove }: AttachmentTrayProps) {
  const [hoveredItem, setHoveredItem] = useState<StagedContextItem | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  if (items.length === 0) return null

  const handleMouseEnter = (item: StagedContextItem, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (timerRef.current) clearTimeout(timerRef.current)

    // Trigger after >= 200ms per RFC
    timerRef.current = setTimeout(() => {
      setPopoverPos({
        x: rect.left,
        y: rect.top - 12, // positioned right above the chip
      })
      setHoveredItem(item)
    }, 200)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setHoveredItem(null)
    setPopoverPos(null)
  }

  const renderIcon = (cat: string) => {
    switch (cat) {
      case "mcp":
        return <Wrench className="size-3.5 text-violet-400 shrink-0" />
      case "skill":
        return <Sparkles className="size-3.5 text-amber-400 shrink-0" />
      case "snippet":
        return <FileCode className="size-3.5 text-emerald-400 shrink-0" />
      case "folder":
        return <FolderGit2 className="size-3.5 text-blue-400 shrink-0" />
      default:
        return <FileText className="size-3.5 text-zinc-400 shrink-0" />
    }
  }

  return (
    <div className="relative px-3 pt-2 pb-1 border-b border-zinc-800/60">
      {/* Horizontal scrolling chip container */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {items.map((item) => (
          <div
            key={item.id}
            onMouseEnter={(e) => handleMouseEnter(item, e)}
            onMouseLeave={handleMouseLeave}
            className="group flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800/80 shrink-0 cursor-default select-none"
          >
            {renderIcon(item.category)}
            <span className="max-w-[120px] truncate font-medium text-zinc-200">
              {item.name}
            </span>

            {/* Metadata Pill */}
            {item.metadata?.lineCount ? (
              <span className="rounded bg-zinc-800 px-1 py-0.2 text-[10px] text-zinc-400">
                {item.metadata.lineCount}L
              </span>
            ) : item.metadata?.byteSize ? (
              <span className="rounded bg-zinc-800 px-1 py-0.2 text-[10px] text-zinc-400">
                {(item.metadata.byteSize / 1024).toFixed(1)} KB
              </span>
            ) : null}

            {/* Click-to-remove button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleMouseLeave()
                onRemove(item.id)
              }}
              className="ml-0.5 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
              aria-label={`Remove ${item.name}`}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Floating Hover Preview Card anchored above hovered chip */}
      {hoveredItem && popoverPos && (
        <div
          className="fixed z-50 transform -translate-y-full"
          style={{ left: Math.max(16, popoverPos.x), top: popoverPos.y }}
        >
          <HoverPreviewCard item={hoveredItem} />
        </div>
      )}
    </div>
  )
}
