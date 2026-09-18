"use client"

import React, { useState, useEffect, useRef } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  PanelRight,
  Folder,
  Minus,
  Square,
  Copy,
  X,
  Keyboard,
  Info,
  Sliders,
  Sparkles,
  FileCode,
  Mic,
  Maximize2,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface WindowHeaderProps {
  projectName?: string
  threadTitle?: string
  isLeftSidebarOpen: boolean
  isRightDrawerOpen: boolean
  onToggleLeftSidebar: () => void
  onToggleRightDrawer: () => void
  onNewChat: () => void
  onCreateProject?: () => void
  onOpenSetupWizard?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
}

export function WindowHeader({
  projectName,
  threadTitle,
  isLeftSidebarOpen,
  isRightDrawerOpen,
  onToggleLeftSidebar,
  onToggleRightDrawer,
  onNewChat,
  onCreateProject,
  onOpenSetupWizard,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
}: WindowHeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "view" | "help" | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const menuContainerRef = useRef<HTMLDivElement>(null)

  // Query window maximization state on mount
  useEffect(() => {
    if (typeof window !== "undefined" && isTauri()) {
      invoke<boolean>("window_is_maximized")
        .then(setIsMaximized)
        .catch(() => {})
    }
  }, [])

  // Close open dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    if (activeMenu) {
      window.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside)
    }
  }, [activeMenu])

  // Window management handlers
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTauri()) {
      await invoke("window_minimize").catch(console.error)
    }
  }

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTauri()) {
      try {
        const next = await invoke<boolean>("window_toggle_maximize")
        setIsMaximized(next)
      } catch (err) {
        console.error(err)
      }
    } else {
      setIsMaximized(!isMaximized)
    }
  }

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTauri()) {
      await invoke("window_close").catch(console.error)
    }
  }

  const handleToggleVoiceHud = async () => {
    if (isTauri()) {
      await invoke("toggle_overlay").catch(console.error)
    }
    setActiveMenu(null)
  }

  return (
    <>
      <header
        data-tauri-drag-region
        className="flex h-10 w-full shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-3 text-xs text-zinc-400 select-none z-30 relative"
      >
        {/* Left Segment: Window Controls / History Arrows & App Menus */}
        <div
          data-tauri-drag-region="false"
          className="flex items-center gap-2 pointer-events-auto"
        >
          {/* Navigation History Arrows */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onGoBack}
              disabled={!canGoBack}
              className={`flex size-6 items-center justify-center rounded transition-colors ${
                canGoBack
                  ? "hover:bg-zinc-800/80 text-zinc-300 cursor-pointer"
                  : "text-zinc-600 cursor-not-allowed opacity-50"
              }`}
              title="Back"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={onGoForward}
              disabled={!canGoForward}
              className={`flex size-6 items-center justify-center rounded transition-colors ${
                canGoForward
                  ? "hover:bg-zinc-800/80 text-zinc-300 cursor-pointer"
                  : "text-zinc-600 cursor-not-allowed opacity-50"
              }`}
              title="Forward"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Standard App Menus with Interactive Dropdowns */}
          <div ref={menuContainerRef} className="hidden sm:flex items-center gap-1 ml-1 text-[11px] text-zinc-400 relative">
            {/* File Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                  activeMenu === "file" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                File
              </button>

              {activeMenu === "file" && (
                <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      onNewChat()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>New Session</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+N</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCreateProject?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>New Workspace...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+N</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSetupWizard?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>Setup Wizard...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+,</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-rose-950/80 hover:text-rose-300 text-zinc-400 text-left transition-colors"
                  >
                    <span>Exit Krypton</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Alt+F4</span>
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === "edit" ? null : "edit")}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                  activeMenu === "edit" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                Edit
              </button>

              {activeMenu === "edit" && (
                <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href)
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>Copy Window URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSetupWizard?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>Preferences...</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                  activeMenu === "view" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                View
              </button>

              {activeMenu === "view" && (
                <div className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleLeftSidebar()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>Toggle Workspaces Sidebar</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+B</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleRightDrawer()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>Toggle Outputs Drawer</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+J</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    onClick={handleToggleVoiceHud}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <span>Toggle Voice Micro-HUD</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+Space</span>
                  </button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === "help" ? null : "help")}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                  activeMenu === "help" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                Help
              </button>

              {activeMenu === "help" && (
                <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      setIsShortcutsOpen(true)
                      setActiveMenu(null)
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <Keyboard className="size-3.5 text-zinc-400" />
                    <span>Keyboard Shortcuts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAboutOpen(true)
                      setActiveMenu(null)
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors"
                  >
                    <Info className="size-3.5 text-zinc-400" />
                    <span>About Krypton</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Segment: Active Project / Thread Breadcrumb (Draggable) */}
        <div
          data-tauri-drag-region
          className="flex-1 flex items-center justify-center min-w-0 max-w-md truncate text-zinc-300 font-medium px-4 cursor-default"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Folder className="size-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{projectName || "No Workspace Open"}</span>
            {threadTitle && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-200 truncate font-normal">{threadTitle}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Segment: Layout Toggles & Unified Window Control Buttons */}
        <div
          data-tauri-drag-region="false"
          className="flex items-center gap-1.5 pointer-events-auto"
        >
          {/* Toggle Left Sidebar */}
          <button
            type="button"
            onClick={onToggleLeftSidebar}
            className={`flex size-7 items-center justify-center rounded hover:bg-zinc-800 transition-colors cursor-pointer ${
              isLeftSidebarOpen ? "text-zinc-300" : "text-zinc-500"
            }`}
            title="Toggle Left Sidebar (Ctrl+B)"
          >
            <PanelLeft className="size-3.5" />
          </button>

          {/* Toggle Right Outputs Drawer */}
          <button
            type="button"
            onClick={onToggleRightDrawer}
            className={`flex size-7 items-center justify-center rounded hover:bg-zinc-800 transition-colors cursor-pointer ${
              isRightDrawerOpen ? "text-zinc-300 bg-zinc-800/50" : "text-zinc-500"
            }`}
            title="Toggle Outputs & Trajectory Drawer (Ctrl+J)"
          >
            <PanelRight className="size-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* Desktop Window Controls Decoration (Wired via Native Tauri IPC) */}
          <div className="flex items-center ml-1">
            <button
              type="button"
              onClick={handleMinimize}
              className="flex size-7 items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus className="size-3" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="flex size-7 items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Copy className="size-2.5" /> : <Square className="size-2.5" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex size-7 items-center justify-center hover:bg-rose-600 hover:text-white text-zinc-400 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ABOUT KRYPTON MODAL */}
      <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-violet-400" />
              <span>About Krypton</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 text-xs text-zinc-400">
            <p className="leading-relaxed">
              <strong>Krypton</strong> is a local-first, cross-platform autonomous desktop AI runtime designed to operate with zero server lock-in.
            </p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex flex-col gap-1.5 font-mono text-[11px] text-zinc-300">
              <div>Version: 0.1.0 (Production Core)</div>
              <div>Runtime: Tauri v2 (Rust) + React 19 / Next.js</div>
              <div>Configuration: ~/.krypton/config.json</div>
              <div>Sandboxing: OS Subprocesses + AST Linter</div>
            </div>
            <p className="text-[11px] text-zinc-500">
              MIT Licensed · All model credentials and telemetry remain strictly on your local host.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* KEYBOARD SHORTCUTS MODAL */}
      <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Keyboard className="size-4 text-violet-400" />
              <span>Keyboard Shortcuts</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2 text-xs">
            {[
              { key: "Ctrl+N", action: "Create new autonomous session" },
              { key: "Ctrl+Shift+N", action: "Create new workspace project" },
              { key: "Ctrl+B", action: "Toggle workspaces sidebar" },
              { key: "Ctrl+J", action: "Toggle task DAG & trajectory drawer" },
              { key: "Ctrl+Shift+Space", action: "Toggle floating Voice Micro-HUD" },
              { key: "Ctrl+,", action: "Open First-Run Setup Wizard / Settings" },
            ].map((sc) => (
              <div key={sc.key} className="flex items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-1.5 border border-zinc-800/80">
                <span className="text-zinc-300">{sc.action}</span>
                <kbd className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400 border border-zinc-700">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
