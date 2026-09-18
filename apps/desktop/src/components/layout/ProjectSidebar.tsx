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
  MessageSquare,
  Sparkles,
  ChevronRight,
  User,
  Plus,
} from "lucide-react"
import { ProjectWorkspace, UserProfileInfo } from "@/hooks/useAgentSession"

interface ProjectSidebarProps {
  projects: ProjectWorkspace[]
  activeProjectId: string
  activeThreadId: string
  onSelectProject: (projectId: string) => void
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
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
  userProfile,
  isOpen,
}: ProjectSidebarProps) {
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)
  const [showAllThreads, setShowAllThreads] = useState(false)

  if (!isOpen) return null

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0]
  const displayedThreads = showAllThreads
    ? activeProject.threads
    : activeProject.threads.slice(0, 5)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-zinc-950/95 text-zinc-300 select-none z-20 transition-all">
      {/* Top Section */}
      <div className="flex flex-col overflow-y-auto no-scrollbar">
        {/* 1. Workspace Header Dropdown */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-900">
          <button
            type="button"
            className="flex items-center gap-1.5 font-semibold text-sm text-zinc-100 hover:text-white transition-colors"
          >
            <span>Krypton</span>
            <ChevronDown className="size-3.5 text-zinc-400" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="size-3.5" />
            </button>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
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
            <span>Projects</span>
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
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => onSelectThread(thread.id)}
                            className={`group flex items-center justify-between w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                              isActiveThread
                                ? "bg-zinc-800/90 text-zinc-100 font-medium"
                                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                            }`}
                          >
                            <span className="truncate pr-1">{thread.title}</span>
                          </button>
                        )
                      })}

                      {/* Show More toggle if threads exceed 5 */}
                      {activeProject.threads.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllThreads(!showAllThreads)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 py-1 px-2 text-left transition-colors"
                        >
                          {showAllThreads ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. Recents Section */}
        <div className="px-2 pt-3 pb-2">
          <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-medium text-zinc-500">
            <span>Recents</span>
          </div>
          <div className="flex flex-col gap-0.5 text-xs text-zinc-400">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1 text-left hover:bg-zinc-900 hover:text-zinc-200 transition-colors truncate"
            >
              <span className="truncate">Fix Docker API connection error</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1 text-left hover:bg-zinc-900 hover:text-zinc-200 transition-colors truncate"
            >
              <span className="truncate">Explain how to run this</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: User Profile & Usage Meter (Matching Image 2/3/4) */}
      <div className="p-2 border-t border-zinc-900 bg-zinc-950/60">
        <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-900/80 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-amber-600 to-rose-500 text-white font-semibold text-xs shrink-0 shadow-sm">
              {userProfile.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-zinc-200 truncate">
                {userProfile.username}
              </span>
            </div>
          </div>

          {/* Usage Pill Badge */}
          <div className="flex items-center gap-1 rounded-full bg-blue-600/90 hover:bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm transition-colors cursor-pointer">
            <span>{userProfile.tokenUsagePercent}%</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
