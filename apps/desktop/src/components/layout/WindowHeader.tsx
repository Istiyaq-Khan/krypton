"use client"

import React, { useState, useEffect, useRef } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Search,
  Bell,
  Settings as SettingsIcon,
  Check,
  Plus,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectWorkspace } from "@/lib/persistence"

interface WindowHeaderProps {
  projectName?: string
  threadTitle?: string
  projects?: ProjectWorkspace[]
  activeProjectId?: string
  isLeftSidebarOpen: boolean
  isRightDrawerOpen: boolean
  onToggleLeftSidebar: () => void
  onToggleRightDrawer: () => void
  onNewChat: () => void
  onCreateProject?: () => void
  onSelectProject?: (projectId: string) => void
  onOpenSetupWizard?: () => void
  onOpenSettings?: (category?: string) => void
  onToggleVoiceHud?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
  onGoBack?: () => void
  onGoForward?: () => void
  onOpenSearch?: () => void
  onOpenNotifications?: () => void
}

export function WindowHeader({
  projectName,
  threadTitle,
  projects,
  activeProjectId,
  isLeftSidebarOpen,
  isRightDrawerOpen,
  onToggleLeftSidebar,
  onToggleRightDrawer,
  onNewChat,
  onCreateProject,
  onSelectProject,
  onOpenSetupWizard,
  onOpenSettings,
  onToggleVoiceHud,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  onOpenSearch,
  onOpenNotifications,
}: WindowHeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false)
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "view" | "settings" | "help" | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const logoMenuRef = useRef<HTMLDivElement>(null)
  const workspaceSwitcherRef = useRef<HTMLDivElement>(null)

  // Query window maximization state on mount and listen to changes
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const updateMaximized = async () => {
      if (typeof window !== "undefined" && isTauri()) {
        try {
          const max = await invoke<boolean>("window_is_maximized")
          setIsMaximized(max)
        } catch {
          // Fallback if invoke fails
        }
      }
    }

    // Initial query on mount
    updateMaximized()

    // Browser window resize listener (fires when OS snaps/restores/maximizes)
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateMaximized)
    }

    // Native Tauri window resize listener
    if (typeof window !== "undefined" && isTauri()) {
      import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) => {
          getCurrentWindow()
            .onResized(() => {
              updateMaximized()
            })
            .then((fn) => {
              unlisten = fn
            })
            .catch(() => {})
        })
        .catch(() => {})
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateMaximized)
      }
      unlisten?.()
    }
  }, [])

  // Close open dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (menuContainerRef.current && !menuContainerRef.current.contains(target)) {
        setActiveMenu(null)
      }
      if (logoMenuRef.current && !logoMenuRef.current.contains(target)) {
        setIsLogoMenuOpen(false)
      }
      if (workspaceSwitcherRef.current && !workspaceSwitcherRef.current.contains(target)) {
        setIsWorkspaceSwitcherOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenu(null)
        setIsLogoMenuOpen(false)
        setIsWorkspaceSwitcherOpen(false)
      }
    }

    if (activeMenu || isLogoMenuOpen || isWorkspaceSwitcherOpen) {
      window.addEventListener("mousedown", handleClickOutside)
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMenu, isLogoMenuOpen, isWorkspaceSwitcherOpen])

  // Wire standard Settings shortcut (Ctrl+, on Windows/Linux, Cmd+, on macOS)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault()
        onOpenSettings?.()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onOpenSettings])

  // Window management handlers
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTauri()) {
      await invoke("window_minimize").catch(console.error)
    }
  }

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
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
    if (onToggleVoiceHud) {
      onToggleVoiceHud()
    } else if (isTauri()) {
      await invoke("toggle_synapse").catch(() => invoke("toggle_overlay").catch(console.error))
    }
    setActiveMenu(null)
    setIsLogoMenuOpen(false)
  }

  const handleHeaderDoubleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Only toggle maximize if double clicking draggable area, not interactive controls
    const isDragRegion =
      target.getAttribute("data-tauri-drag-region") !== null &&
      target.getAttribute("data-tauri-drag-region") !== "false"
    if (isDragRegion) {
      await handleToggleMaximize(e)
    }
  }

  return (
    <>
      <header
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        onDoubleClick={handleHeaderDoubleClick}
        className="flex h-10 w-full shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-3 text-xs text-zinc-400 select-none z-30 relative app-region-drag"
      >
        {/* Left Segment: App Logo/Dropdown, History Arrows & App Menus */}
        <div
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="flex items-center gap-2 pointer-events-auto shrink-0 app-region-no-drag z-10"
        >
          {/* App Logo & Quick Actions Dropdown */}
          <div ref={logoMenuRef} className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => {
                setIsLogoMenuOpen(!isLogoMenuOpen)
                setActiveMenu(null)
              }}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors pointer-events-auto cursor-pointer group"
              title="Krypton Menu"
            >
              <div className="size-4.5 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xs">
                <Sparkles className="size-2.5 text-white" />
              </div>
              <span className="font-semibold text-xs tracking-tight text-zinc-200 group-hover:text-white">Krypton</span>
              <ChevronDown className="size-3 text-zinc-400 group-hover:text-zinc-200" />
            </button>

            {isLogoMenuOpen && (
              <div
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto"
              >
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    onNewChat()
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>New Session</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Ctrl+N</span>
                </button>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    onCreateProject?.()
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>New Workspace...</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+N</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    onOpenSettings?.()
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>Settings...</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Ctrl+,</span>
                </button>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    handleToggleVoiceHud()
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>Toggle Krypton Synapse</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+Space</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    setIsShortcutsOpen(true)
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>Keyboard Shortcuts</span>
                </button>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={() => {
                    setIsAboutOpen(true)
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>About Krypton</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  onClick={handleClose}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-rose-950/80 hover:text-rose-300 text-zinc-400 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>Exit Krypton</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Alt+F4</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation History Arrows */}
          <div
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex items-center gap-0.5 pointer-events-auto"
          >
            <button
              type="button"
              onClick={onGoBack}
              disabled={!canGoBack}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className={`flex size-6 items-center justify-center rounded transition-colors pointer-events-auto ${
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
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className={`flex size-6 items-center justify-center rounded transition-colors pointer-events-auto ${
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
          <div
            ref={menuContainerRef}
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="hidden sm:flex items-center gap-1 ml-0.5 text-[11px] text-zinc-400 relative pointer-events-auto"
          >
            {/* File Menu */}
            <div className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  setActiveMenu(activeMenu === "file" ? null : "file")
                  setIsLogoMenuOpen(false)
                }}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer pointer-events-auto ${
                  activeMenu === "file" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                File
              </button>

              {activeMenu === "file" && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto"
                >
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onNewChat()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>New Session</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+N</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onCreateProject?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>New Workspace...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+N</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Settings...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+,</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={handleClose}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-rose-950/80 hover:text-rose-300 text-zinc-400 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Exit Krypton</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Alt+F4</span>
                  </button>
                </div>
              )}
            </div>

            {/* Edit Menu */}
            <div className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  setActiveMenu(activeMenu === "edit" ? null : "edit")
                  setIsLogoMenuOpen(false)
                }}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer pointer-events-auto ${
                  activeMenu === "edit" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                Edit
              </button>

              {activeMenu === "edit" && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto"
                >
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href)
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Copy Window URL</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Preferences...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+,</span>
                  </button>
                </div>
              )}
            </div>

            {/* View Menu */}
            <div className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  setActiveMenu(activeMenu === "view" ? null : "view")
                  setIsLogoMenuOpen(false)
                }}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer pointer-events-auto ${
                  activeMenu === "view" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                View
              </button>

              {activeMenu === "view" && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto"
                >
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onToggleLeftSidebar()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Toggle Workspaces Sidebar</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+B</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onToggleRightDrawer()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Toggle Outputs Drawer</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+J</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={handleToggleVoiceHud}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Toggle Krypton Synapse</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+Space</span>
                  </button>
                </div>
              )}
            </div>

            {/* Settings Menu */}
            <div className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  setActiveMenu(activeMenu === "settings" ? null : "settings")
                  setIsLogoMenuOpen(false)
                }}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer pointer-events-auto ${
                  activeMenu === "settings" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                Settings
              </button>

              {activeMenu === "settings" && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto"
                >
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span className="font-medium">Preferences...</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+,</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.("general")
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>General</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.("agents")
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Agents & Identity</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.("providers")
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Model Providers</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.("appearance")
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Appearance</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSettings?.("data")
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Data & Maintenance</span>
                  </button>
                  <div className="h-px bg-zinc-800 my-1" />

                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      onOpenSetupWizard?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-400 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Setup Wizard...</span>
                  </button>
                </div>
              )}
            </div>

            {/* Help Menu */}
            <div className="relative" data-tauri-drag-region="false" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={() => {
                  setActiveMenu(activeMenu === "help" ? null : "help")
                  setIsLogoMenuOpen(false)
                }}
                className={`px-2 py-1 rounded hover:bg-zinc-800/80 transition-colors cursor-pointer pointer-events-auto ${
                  activeMenu === "help" ? "bg-zinc-800 text-zinc-100 font-medium" : "hover:text-zinc-200"
                }`}
              >
                Help
              </button>

              {activeMenu === "help" && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto"
                >
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      setIsShortcutsOpen(true)
                      setActiveMenu(null)
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <Keyboard className="size-3.5 text-zinc-400" />
                    <span>Keyboard Shortcuts</span>
                  </button>
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      setIsAboutOpen(true)
                      setActiveMenu(null)
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <Info className="size-3.5 text-zinc-400" />
                    <span>About Krypton</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Empty Draggable Region between Menus and Breadcrumbs */}
        <div
          data-tauri-drag-region
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="flex-1 h-full min-w-4 cursor-default app-region-drag"
        />

        {/* Middle Segment: Breadcrumbs (Click-Isolated) */}
        <div
          ref={workspaceSwitcherRef}
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="relative flex items-center justify-center shrink-0 min-w-0 max-w-md pointer-events-auto app-region-no-drag z-10"
        >
          <button
            type="button"
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={(e) => {
              e.stopPropagation()
              setIsWorkspaceSwitcherOpen((prev) => !prev)
              setActiveMenu(null)
              setIsLogoMenuOpen(false)
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer border truncate text-xs pointer-events-auto ${
              isWorkspaceSwitcherOpen
                ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                : "hover:bg-zinc-900/90 text-zinc-300 border-transparent hover:border-zinc-800/80"
            }`}
            title={`Workspace: ${projectName || "No Workspace Open"}${threadTitle ? ` / ${threadTitle}` : ""} (Click to switch)`}
            aria-expanded={isWorkspaceSwitcherOpen}
            aria-haspopup="true"
          >
            <Folder className="size-3.5 text-zinc-500 shrink-0" />
            <span className="truncate font-medium">{projectName || "No Workspace Open"}</span>
            {threadTitle && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-200 truncate font-normal">{threadTitle}</span>
              </>
            )}
            <ChevronDown
              className={`size-3 text-zinc-500 transition-transform ${
                isWorkspaceSwitcherOpen ? "rotate-180 text-zinc-300" : ""
              }`}
            />
          </button>

          {/* Workspace Switcher Popover */}
          {isWorkspaceSwitcherOpen && (
            <div
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-80 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 text-xs flex flex-col pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800/80 text-[11px] font-semibold text-zinc-400">
                <span>Switch Workspace</span>
                <span className="text-[10px] text-zinc-500 font-normal">
                  {projects?.length || 0} available
                </span>
              </div>

              {/* Workspaces List */}
              <div className="max-h-60 overflow-y-auto no-scrollbar flex flex-col gap-0.5 py-1">
                {!projects || projects.length === 0 ? (
                  <div className="px-3 py-4 text-center text-zinc-500 text-xs">
                    No workspaces configured
                  </div>
                ) : (
                  projects.map((proj) => {
                    const isSelected = proj.id === activeProjectId
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        data-tauri-drag-region="false"
                        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                        onClick={() => {
                          onSelectProject?.(proj.id)
                          setIsWorkspaceSwitcherOpen(false)
                        }}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors pointer-events-auto cursor-pointer ${
                          isSelected
                            ? "bg-zinc-800/90 text-zinc-100 font-medium border border-zinc-700/50"
                            : "hover:bg-zinc-800/50 text-zinc-300 hover:text-zinc-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <Folder
                            className={`size-3.5 shrink-0 ${
                              isSelected ? "text-violet-400" : "text-zinc-500"
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs">{proj.name}</span>
                            <span className="truncate text-[10px] text-zinc-500 font-mono">
                              {proj.path}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-zinc-500">
                            {proj.threads.length} {proj.threads.length === 1 ? "session" : "sessions"}
                          </span>
                          {isSelected && <Check className="size-3.5 text-violet-400 shrink-0" />}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Bottom Action: New Workspace */}
              {onCreateProject && (
                <>
                  <div className="h-px bg-zinc-800/80 my-1" />
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={() => {
                      setIsWorkspaceSwitcherOpen(false)
                      onCreateProject()
                    }}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors pointer-events-auto cursor-pointer text-xs"
                  >
                    <Plus className="size-3.5 text-zinc-400" />
                    <span>New Workspace...</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Empty Draggable Region between Breadcrumbs and Controls */}
        <div
          data-tauri-drag-region
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="flex-1 h-full min-w-4 cursor-default app-region-drag"
        />

        {/* Right Segment: Search, Notifications, Layout Toggles & Window Controls */}
        <div
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="flex items-center gap-1 shrink-0 pointer-events-auto app-region-no-drag z-10"
        >
          {/* Search Icon Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex size-7 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer pointer-events-auto"
            title="Search (Ctrl+K)"
          >
            <Search className="size-3.5" />
          </button>

          {/* Notifications Icon Button */}
          <button
            type="button"
            onClick={onOpenNotifications || onToggleRightDrawer}
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex size-7 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer pointer-events-auto relative"
            title="Notifications"
          >
            <Bell className="size-3.5" />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-violet-500" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-0.5" />

          {/* Toggle Left Sidebar */}
          <button
            type="button"
            onClick={onToggleLeftSidebar}
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className={`flex size-7 items-center justify-center rounded hover:bg-zinc-800 transition-colors cursor-pointer pointer-events-auto ${
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
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className={`flex size-7 items-center justify-center rounded hover:bg-zinc-800 transition-colors cursor-pointer pointer-events-auto ${
              isRightDrawerOpen ? "text-zinc-300 bg-zinc-800/50" : "text-zinc-500"
            }`}
            title="Toggle Outputs & Trajectory Drawer (Ctrl+J)"
          >
            <PanelRight className="size-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-0.5" />

          {/* Native Window Controls (Wired via Tauri Desktop IPC) */}
          <div
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex items-center ml-0.5 pointer-events-auto"
          >
            <button
              type="button"
              onClick={handleMinimize}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex size-7 items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer pointer-events-auto"
              title="Minimize"
            >
              <Minus className="size-3" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex size-7 items-center justify-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer pointer-events-auto"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Copy className="size-2.5" /> : <Square className="size-2.5" />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex size-7 items-center justify-center hover:bg-rose-600 hover:text-white text-zinc-400 transition-colors cursor-pointer pointer-events-auto"
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
              { key: "Ctrl+Shift+Space", action: "Toggle Krypton Synapse" },
              { key: "Ctrl+,", action: "Open Settings / Preferences (Krypton View)" },
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
