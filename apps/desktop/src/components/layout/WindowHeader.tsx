"use client"

import React from "react"
import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelRight,
  Sparkles,
  Share2,
  Folder,
  Minus,
  Square,
  X,
} from "lucide-react"

interface WindowHeaderProps {
  projectName?: string
  threadTitle?: string
  isLeftSidebarOpen: boolean
  isRightDrawerOpen: boolean
  onToggleLeftSidebar: () => void
  onToggleRightDrawer: () => void
  onNewChat: () => void
}

export function WindowHeader({
  projectName = "clash bot engine",
  threadTitle,
  isLeftSidebarOpen,
  isRightDrawerOpen,
  onToggleLeftSidebar,
  onToggleRightDrawer,
  onNewChat,
}: WindowHeaderProps) {
  return (
    <header className="flex h-10 w-full shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-3 text-xs text-zinc-400 select-none z-30">
      {/* Left Segment: Window Controls / History Arrows & App Menus */}
      <div className="flex items-center gap-2">
        {/* Navigation History Arrows */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Back"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Forward"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Standard App Menus */}
        <div className="hidden sm:flex items-center gap-3 ml-2 text-[11px] text-zinc-400">
          <button type="button" className="hover:text-zinc-200 transition-colors">
            File
          </button>
          <button type="button" className="hover:text-zinc-200 transition-colors">
            Edit
          </button>
          <button type="button" className="hover:text-zinc-200 transition-colors">
            View
          </button>
          <button type="button" className="hover:text-zinc-200 transition-colors">
            Help
          </button>
        </div>
      </div>

      {/* Middle Segment: Active Project / Thread Breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0 max-w-md truncate text-zinc-300 font-medium">
        <Folder className="size-3.5 text-zinc-400 shrink-0" />
        <span className="truncate">{projectName}</span>
        {threadTitle && (
          <>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 truncate font-normal">{threadTitle}</span>
          </>
        )}
      </div>

      {/* Right Segment: Layout Toggles & Window Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Left Sidebar */}
        <button
          type="button"
          onClick={onToggleLeftSidebar}
          className={`flex size-7 items-center justify-center rounded hover:bg-zinc-800 transition-colors ${
            isLeftSidebarOpen ? "text-zinc-300" : "text-zinc-500"
          }`}
          title="Toggle Left Sidebar"
        >
          <PanelLeft className="size-3.5" />
        </button>

        {/* Toggle Right Outputs Drawer */}
        <button
          type="button"
          onClick={onToggleRightDrawer}
          className={`flex size-7 items-center justify-center rounded hover:bg-zinc-800 transition-colors ${
            isRightDrawerOpen ? "text-zinc-300 bg-zinc-800/50" : "text-zinc-500"
          }`}
          title="Toggle Outputs & Trajectory Drawer"
        >
          <PanelRight className="size-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Share Button */}
        <button
          type="button"
          className="hidden sm:flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <Share2 className="size-3" />
          <span>Share</span>
        </button>

        {/* Desktop Window Controls Decoration */}
        <div className="flex items-center ml-2">
          <button
            type="button"
            className="flex size-7 items-center justify-center hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            <Minus className="size-3" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            <Square className="size-2.5" />
          </button>
          <button
            type="button"
            className="flex size-7 items-center justify-center hover:bg-rose-950/80 hover:text-rose-300 text-zinc-400 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
