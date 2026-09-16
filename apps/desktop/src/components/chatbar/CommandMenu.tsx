import React, { useEffect, useRef } from "react"
import { CommandItem } from "./useChatbarState"
import {
  GitCommit,
  Globe,
  ShieldAlert,
  Terminal,
  FileCode,
  FileText,
  CheckSquare,
  FolderGit2,
  Wrench,
  Sparkles,
} from "lucide-react"

interface CommandMenuProps {
  type: "/" | "@"
  items: CommandItem[]
  selectedIndex: number
  onSelect: (item: CommandItem) => void
  onClose: () => void
}

export function CommandMenu({
  type,
  items,
  selectedIndex,
  onSelect,
  onClose,
}: CommandMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Click-outside listener per RFC section 3.3
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener("mousedown", handleMouseDown)
    return () => window.removeEventListener("mousedown", handleMouseDown)
  }, [onClose])

  if (items.length === 0) return null

  const getIcon = (name: string) => {
    switch (name) {
      case "GitCommit":
        return <GitCommit className="size-4 text-violet-400" />
      case "Globe":
        return <Globe className="size-4 text-sky-400" />
      case "ShieldAlert":
        return <ShieldAlert className="size-4 text-amber-400" />
      case "Terminal":
        return <Terminal className="size-4 text-emerald-400" />
      case "FileCode":
        return <FileCode className="size-4 text-emerald-400" />
      case "FileText":
        return <FileText className="size-4 text-zinc-400" />
      case "CheckSquare":
        return <CheckSquare className="size-4 text-indigo-400" />
      case "FolderGit2":
        return <FolderGit2 className="size-4 text-blue-400" />
      default:
        return <Wrench className="size-4 text-violet-400" />
    }
  }

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-80 max-h-64 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
    >
      <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
        {type === "/" ? "Tools & Action Registry (/)" : "Workspace Context (@)"}
      </div>

      <div className="flex flex-col gap-0.5 mt-1">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer ${
                isSelected
                  ? "bg-violet-600/20 text-zinc-100 border border-violet-500/40"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 border border-transparent"
              }`}
            >
              <div className="shrink-0">{getIcon(item.iconName)}</div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium truncate">
                    {type}
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="text-[10px] text-zinc-500 truncate ml-2">
                      {item.detail}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {item.description}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
