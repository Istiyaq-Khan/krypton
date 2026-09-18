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
  FolderOpen,
  Plus,
  Minus,
  Square,
  Copy,
  X,
  Keyboard,
  Info,
  Sparkles,
  Search,
  Bell,
  MessageSquare,
  Check,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectWorkspace, AgentThread } from "@/lib/persistence"

export interface WindowHeaderProps {
  projectName?: string
  threadTitle?: string
  projects?: ProjectWorkspace[]
  activeProjectId?: string
  onSelectProject?: (projectId: string) => void
  onCreateProject?: (name?: string, path?: string) => void
  onOpenFolder?: () => void
  threads?: AgentThread[]
  activeThreadId?: string
  onSelectThread?: (threadId: string) => void
  isLeftSidebarOpen: boolean
  isRightDrawerOpen: boolean
  onToggleLeftSidebar: () => void
  onToggleRightDrawer: () => void
  onNewChat: () => void
  onOpenSetupWizard?: () => void
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
  onSelectProject,
  onCreateProject,
  onOpenFolder,
  threads,
  activeThreadId,
  onSelectThread,
  isLeftSidebarOpen,
  isRightDrawerOpen,
  onToggleLeftSidebar,
  onToggleRightDrawer,
  onNewChat,
  onCreateProject: onCreateProjectProp,
  onOpenSetupWizard,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  onOpenSearch,
  onOpenNotifications,
}: WindowHeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "view" | "help" | null>(null)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)

  // Interactive Breadcrumbs Popover State
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false)
  const [sessionSearchQuery, setSessionSearchQuery] = useState("")
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectPath, setNewProjectPath] = useState("")

  const menuContainerRef = useRef<HTMLDivElement>(null)
  const logoMenuRef = useRef<HTMLDivElement>(null)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  const sessionMenuRef = useRef<HTMLDivElement>(null)
  const sessionSearchInputRef = useRef<HTMLInputElement>(null)

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
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(target)) {
        setIsWorkspaceMenuOpen(false)
      }
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(target)) {
        setIsSessionMenuOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenu(null)
        setIsLogoMenuOpen(false)
        setIsWorkspaceMenuOpen(false)
        setIsSessionMenuOpen(false)
        setSessionSearchQuery("")
      }
    }

    window.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // Auto-focus search input when session popover opens
  useEffect(() => {
    if (isSessionMenuOpen) {
      const timer = setTimeout(() => {
        sessionSearchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isSessionMenuOpen])

  // Derive active workspace/project and session/thread details
  const currentProject = projects?.find((p) => p.id === activeProjectId) || projects?.[0]
  const currentWorkspaceName = projectName || currentProject?.name || ""

  const currentSessions = threads || currentProject?.threads || []
  const currentSession = currentSessions.find((t) => t.id === activeThreadId) || currentSessions[0]
  const currentSessionTitle = threadTitle || currentSession?.title || ""

  const filteredSessions = currentSessions.filter((t) =>
    t.title.toLowerCase().includes(sessionSearchQuery.toLowerCase().trim())
  )

  const handleOpenFolder = async () => {
    setIsWorkspaceMenuOpen(false)
    if (onOpenFolder) {
      onOpenFolder()
      return
    }
    if (typeof window !== "undefined" && isTauri()) {
      try {
        const selected = await invoke<string | null>("open_folder_dialog")
        if (selected) {
          const clean = selected.replace(/\\/g, "/")
          const folderName = clean.split("/").filter(Boolean).pop() || "workspace"
          const createFn = onCreateProject || onCreateProjectProp
          createFn?.(folderName, selected)
        }
      } catch (err) {
        console.warn("open_folder_dialog error:", err)
      }
    }
  }

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    const createFn = onCreateProject || onCreateProjectProp
    createFn?.(newProjectName.trim(), newProjectPath.trim() || `projects/${newProjectName.trim()}`)
    setNewProjectName("")
    setNewProjectPath("")
    setIsNewProjectModalOpen(false)
  }

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
    if (isTauri()) {
      await invoke("toggle_overlay").catch(console.error)
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
                    onOpenSetupWizard?.()
                    setIsLogoMenuOpen(false)
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                >
                  <span>Setup Wizard...</span>
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
                  <span>Toggle Voice Micro-HUD</span>
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
                      onOpenSetupWizard?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Setup Wizard...</span>
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
                      onOpenSetupWizard?.()
                      setActiveMenu(null)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-200 text-left transition-colors pointer-events-auto cursor-pointer"
                  >
                    <span>Preferences...</span>
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
                    <span>Toggle Voice Micro-HUD</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+Space</span>
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
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="flex items-center justify-center shrink-0 min-w-0 max-w-xl pointer-events-auto app-region-no-drag z-10"
        >
          <div
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex items-center gap-0.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-0.5 text-xs text-zinc-300 pointer-events-auto shadow-xs backdrop-blur-sm"
          >
            {/* 1. Left Segment: Workspace Switcher Popover */}
            <div
              ref={workspaceMenuRef}
              className="relative"
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                onClick={() => {
                  setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)
                  setIsSessionMenuOpen(false)
                  setActiveMenu(null)
                  setIsLogoMenuOpen(false)
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border border-transparent pointer-events-auto cursor-pointer ${
                  isWorkspaceMenuOpen
                    ? "bg-zinc-800 text-white border-zinc-700/80 shadow-xs"
                    : "hover:bg-zinc-800/70 hover:text-zinc-100 text-zinc-300"
                }`}
                title={`Workspace: ${currentWorkspaceName || "No Workspace Open"}`}
              >
                <Folder className="size-3.5 text-violet-400 group-hover:text-violet-300 transition-colors shrink-0" />
                <span className="truncate max-w-[130px]">{currentWorkspaceName || "No Workspace"}</span>
                <ChevronDown
                  className={`size-3 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200 shrink-0 ${
                    isWorkspaceMenuOpen ? "rotate-180 text-violet-300" : ""
                  }`}
                />
              </button>

              {/* Workspace Popover Dropdown */}
              {isWorkspaceMenuOpen && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-72 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs flex flex-col pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <span>Workspaces</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.2 font-mono text-[10px] text-zinc-400">
                      {projects?.length || 0}
                    </span>
                  </div>

                  {/* Workspaces List */}
                  <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto no-scrollbar py-0.5">
                    {projects && projects.length > 0 ? (
                      projects.map((proj) => {
                        const isActive = proj.id === activeProjectId || proj.name === currentWorkspaceName
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            data-tauri-drag-region="false"
                            style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                            onClick={() => {
                              onSelectProject?.(proj.id)
                              setIsWorkspaceMenuOpen(false)
                            }}
                            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer pointer-events-auto group ${
                              isActive
                                ? "bg-violet-950/40 text-violet-200 font-medium border border-violet-800/40"
                                : "hover:bg-zinc-800/80 text-zinc-300 hover:text-zinc-100"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className={`size-3.5 shrink-0 ${isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-xs">{proj.name}</span>
                                {proj.path && (
                                  <span className="truncate text-[10px] text-zinc-500 font-mono max-w-[190px]">
                                    {proj.path}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isActive && <Check className="size-3.5 text-violet-400 shrink-0" />}
                          </button>
                        )
                      })
                    ) : (
                      /* Elegant Zero State */
                      <div className="flex flex-col items-center justify-center p-4 text-center border border-dashed border-zinc-800/80 rounded-lg my-1 bg-zinc-950/40">
                        <Folder className="size-5 text-zinc-600 mb-1.5" />
                        <span className="text-zinc-300 text-xs font-medium">No Workspaces Found</span>
                        <span className="text-[10px] text-zinc-500 mt-0.5 mb-2">
                          Create or open a folder to get started.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-zinc-800/80 my-1" />

                  {/* Actions */}
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                    onClick={handleOpenFolder}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer pointer-events-auto w-full text-left"
                  >
                    <FolderOpen className="size-3.5 text-indigo-400 shrink-0" />
                    <span>Open Folder...</span>
                  </button>

                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false)
                      setIsNewProjectModalOpen(true)
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer pointer-events-auto w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="size-3.5 text-violet-400 shrink-0" />
                      <span>New Project...</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+N</span>
                  </button>
                </div>
              )}
            </div>

            {/* Breadcrumb Separator */}
            <span className="text-zinc-600 select-none text-xs px-0.5">/</span>

            {/* 2. Right Segment: Session Switcher Popover */}
            <div
              ref={sessionMenuRef}
              className="relative"
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <button
                type="button"
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                onClick={() => {
                  setIsSessionMenuOpen(!isSessionMenuOpen)
                  setIsWorkspaceMenuOpen(false)
                  setActiveMenu(null)
                  setIsLogoMenuOpen(false)
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-normal transition-all border border-transparent pointer-events-auto cursor-pointer ${
                  isSessionMenuOpen
                    ? "bg-zinc-800 text-white border-zinc-700/80 shadow-xs"
                    : "hover:bg-zinc-800/70 hover:text-zinc-100 text-zinc-300"
                }`}
                title={`Session: ${currentSessionTitle || "No Active Session"}`}
              >
                <MessageSquare className="size-3.5 text-cyan-400 group-hover:text-cyan-300 transition-colors shrink-0" />
                <span className="truncate max-w-[140px]">{currentSessionTitle || "No Session"}</span>
                <ChevronDown
                  className={`size-3 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200 shrink-0 ${
                    isSessionMenuOpen ? "rotate-180 text-cyan-300" : ""
                  }`}
                />
              </button>

              {/* Session Popover Dropdown */}
              {isSessionMenuOpen && (
                <div
                  data-tauri-drag-region="false"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  className="absolute left-0 top-full mt-1.5 w-80 rounded-xl border border-zinc-800 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-2xl z-50 text-xs flex flex-col pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
                >
                  {/* Search Input Filter */}
                  <div className="relative mb-1 px-1 pt-0.5">
                    <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={sessionSearchInputRef}
                      type="text"
                      placeholder="Search sessions..."
                      value={sessionSearchQuery}
                      onChange={(e) => setSessionSearchQuery(e.target.value)}
                      data-tauri-drag-region="false"
                      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all pointer-events-auto"
                    />
                    {sessionSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSessionSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <span>Recent Sessions</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.2 font-mono text-[10px] text-zinc-400">
                      {filteredSessions.length}
                    </span>
                  </div>

                  {/* Sessions List */}
                  <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto no-scrollbar py-0.5">
                    {currentSessions.length === 0 ? (
                      /* Elegant Zero State */
                      <div className="flex flex-col items-center justify-center p-4 text-center border border-dashed border-zinc-800/80 rounded-lg my-1 bg-zinc-950/40">
                        <MessageSquare className="size-5 text-zinc-600 mb-1.5" />
                        <span className="text-zinc-300 text-xs font-medium">No Sessions Found</span>
                        <span className="text-[10px] text-zinc-500 mt-0.5 mb-2">
                          Start a new autonomous session.
                        </span>
                      </div>
                    ) : filteredSessions.length === 0 ? (
                      /* Zero search matches */
                      <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-500 text-xs">
                        <span>No sessions matching &quot;{sessionSearchQuery}&quot;</span>
                      </div>
                    ) : (
                      filteredSessions.map((thread) => {
                        const isActive = thread.id === activeThreadId || thread.title === currentSessionTitle
                        return (
                          <button
                            key={thread.id}
                            type="button"
                            data-tauri-drag-region="false"
                            style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                            onClick={() => {
                              onSelectThread?.(thread.id)
                              setIsSessionMenuOpen(false)
                              setSessionSearchQuery("")
                            }}
                            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer pointer-events-auto group ${
                              isActive
                                ? "bg-cyan-950/40 text-cyan-200 font-medium border border-cyan-800/40"
                                : "hover:bg-zinc-800/80 text-zinc-300 hover:text-zinc-100"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <MessageSquare className={`size-3.5 shrink-0 ${isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-xs">{thread.title}</span>
                                <span className="text-[10px] text-zinc-500">
                                  {thread.messages?.length || 0} messages
                                </span>
                              </div>
                            </div>
                            {isActive && <Check className="size-3.5 text-cyan-400 shrink-0" />}
                          </button>
                        )
                      })
                    )}
                  </div>

                  <div className="h-px bg-zinc-800/80 my-1" />

                  {/* + New Session Action */}
                  <button
                    type="button"
                    data-tauri-drag-region="false"
                    style={{ WebkitAppRegion: "no-drag", cursor: "pointer" } as React.CSSProperties}
                    onClick={() => {
                      onNewChat()
                      setIsSessionMenuOpen(false)
                      setSessionSearchQuery("")
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer pointer-events-auto w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="size-3.5 text-cyan-400 shrink-0" />
                      <span>New Session</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Ctrl+N</span>
                  </button>
                </div>
              )}
            </div>
          </div>
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

      {/* CREATE WORKSPACE PROJECT MODAL */}
      <Dialog open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen}>
        <DialogContent className="max-w-sm bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Folder className="size-4 text-violet-400" />
              <span>New Workspace Project</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-3 pt-2 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Workspace Name</label>
              <input
                type="text"
                placeholder="e.g. agent-workspace"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Filesystem Path (Optional)</label>
              <input
                type="text"
                placeholder="e.g. projects/agent-workspace"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-white font-medium cursor-pointer"
              >
                Create Workspace
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
