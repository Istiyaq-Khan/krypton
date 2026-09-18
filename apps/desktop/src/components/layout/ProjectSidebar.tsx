"use client"

import React, { useState } from "react"
import {
  ChevronDown,
  Search,
  Bell,
  SquarePen,
  GitPullRequest,
  Clock,
  AtSign,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react"
import { ProjectWorkspace, UserProfileInfo } from "@/lib/persistence"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ProjectSidebarProps {
  projects: ProjectWorkspace[]
  activeProjectId: string
  activeThreadId: string
  onSelectProject: (projectId: string) => void
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  onCreateProject?: (name: string, path: string) => void
  onDeleteThread?: (threadId: string) => void
  userProfile: UserProfileInfo
  isOpen: boolean
}

export function ProjectSidebar({
  projects,
  activeProjectId,
  activeThreadId,
  onSelectProject,
  onSelectThread,
  onNewChat,
  onCreateProject,
  onDeleteThread,
  userProfile,
  isOpen,
}: ProjectSidebarProps) {
  const [showAllThreads, setShowAllThreads] = useState(false)
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [newProjName, setNewProjName] = useState("")
  const [newProjPath, setNewProjPath] = useState("")

  if (!isOpen) return null

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0]
  const displayedThreads = activeProject
    ? showAllThreads
      ? activeProject.threads
      : activeProject.threads.slice(0, 6)
    : []

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjName.trim()) return

    onCreateProject?.(newProjName.trim(), newProjPath.trim() || `E:/all my code/${newProjName.trim()}`)
    setNewProjName("")
    setNewProjPath("")
    setIsNewProjectModalOpen(false)
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950/95 text-zinc-300 select-none z-20 transition-all">
      {/* Top Section */}
      <div className="flex flex-col overflow-y-auto no-scrollbar">
        {/* 1. Workspace Header Dropdown */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-900">
          <button
            type="button"
            className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100 hover:text-white transition-colors cursor-pointer"
          >
            <span>Krypton</span>
            <ChevronDown className="size-3.5 text-zinc-400" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Search (Ctrl+K)"
            >
              <Search className="size-3.5" />
            </button>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="size-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Top Nav Items */}
        <div className="flex flex-col gap-0.5 px-2 py-2 text-xs">
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 hover:bg-zinc-900 text-zinc-200 hover:text-white transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <SquarePen className="size-4 text-zinc-400 group-hover:text-zinc-200" />
              <span>New chat</span>
            </div>
            <Plus className="size-3.5 text-zinc-500 group-hover:text-zinc-300" />
          </button>

          <button
            type="button"
            className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <GitPullRequest className="size-4 text-zinc-400" />
            <span>Pull requests</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Clock className="size-4 text-zinc-400" />
            <span>Scheduled</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <AtSign className="size-4 text-zinc-400" />
            <span>Plugins</span>
          </button>
        </div>

        {/* 3. Projects Section */}
        <div className="px-2 pt-3 pb-1">
          <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-medium text-zinc-500">
            <span>Workspaces</span>
            <button
              type="button"
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex size-5 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Add Workspace Project"
            >
              <Plus className="size-3" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5 text-xs">
            {projects.map((proj) => {
              const isActiveProject = proj.id === activeProjectId

              return (
                <div key={proj.id} className="flex flex-col">
                  {/* Project Folder Row */}
                  <button
                    type="button"
                    onClick={() => onSelectProject(proj.id)}
                    className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                      isActiveProject
                        ? "bg-zinc-900 font-medium text-zinc-100"
                        : "hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isActiveProject ? (
                      <FolderOpen className="size-3.5 text-zinc-300 shrink-0" />
                    ) : (
                      <Folder className="size-3.5 text-zinc-500 shrink-0" />
                    )}
                    <span className="truncate">{proj.name}</span>
                  </button>

                  {/* Active Project Threads List */}
                  {isActiveProject && proj.threads.length > 0 && (
                    <div className="ml-4 pl-2 border-l border-zinc-800/80 flex flex-col gap-0.5 my-1">
                      {displayedThreads.map((thread) => {
                        const isActiveThread = thread.id === activeThreadId

                        return (
                          <div
                            key={thread.id}
                            className={`group flex items-center justify-between w-full rounded-md px-2 py-1 text-left text-xs transition-colors cursor-pointer ${
                              isActiveThread
                                ? "bg-zinc-800/90 text-zinc-100 font-medium"
                                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectThread(thread.id)}
                              className="truncate pr-1 text-left flex-1"
                            >
                              {thread.title}
                            </button>

                            {onDeleteThread && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteThread(thread.id)
                                }}
                                className="opacity-0 group-hover:opacity-100 size-4 flex items-center justify-center rounded hover:text-rose-400 text-zinc-500 transition-opacity"
                                title="Delete session"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        )
                      })}

                      {/* Show More toggle if threads exceed 6 */}
                      {activeProject.threads.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setShowAllThreads(!showAllThreads)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 py-1 px-2 text-left transition-colors cursor-pointer"
                        >
                          {showAllThreads ? "Show less" : `Show ${activeProject.threads.length - 6} more`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: User Profile & Usage Meter */}
      <div className="p-2 border-t border-zinc-900 bg-zinc-950/60">
        <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-900/80 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-semibold text-xs shrink-0 shadow-sm">
              {userProfile.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-zinc-200 truncate">
                {userProfile.username}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {userProfile.latencyMs || 28}ms · {userProfile.planName}
              </span>
            </div>
          </div>

          {/* Usage Pill Badge */}
          <div className="flex items-center gap-1 rounded-full bg-violet-600/90 hover:bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm transition-colors cursor-pointer">
            <span>{userProfile.tokenUsagePercent}%</span>
          </div>
        </div>
      </div>

      {/* CREATE WORKSPACE PROJECT MODAL */}
      <Dialog open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen}>
        <DialogContent className="max-w-sm bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">New Workspace Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-3 pt-2 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Workspace Name</label>
              <input
                type="text"
                placeholder="e.g. clash-bot-engine"
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Filesystem Path</label>
              <input
                type="text"
                placeholder="e.g. E:/all my code/clash-bot-engine"
                value={newProjPath}
                onChange={(e) => setNewProjPath(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-white font-medium"
              >
                Create Workspace
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
