"use client"

import React, { useState, useEffect, useCallback } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { useAgentSession } from "@/hooks/useAgentSession"
import { useKryptonDaemon } from "@/hooks/useKryptonDaemon"
import { WindowHeader } from "@/components/layout/WindowHeader"
import { ProjectSidebar } from "@/components/layout/ProjectSidebar"
import { OutputsDrawer } from "@/components/layout/OutputsDrawer"
import { ExecutionStream } from "@/components/stream/ExecutionStream"
import { CommandContextBar } from "@/components/chatbar/CommandContextBar"
import { QuestionModal } from "@/components/QuestionModal"
import { VcsDiffViewer } from "@/components/VcsDiffViewer"
import { FloatingVoiceAgent } from "@/components/voice/FloatingVoiceAgent"
import { FirstRunSetupWizard, SetupCompletedData } from "@/components/setup/FirstRunSetupWizard"
import { KryptonSettings, SettingsCategory } from "@/components/settings/KryptonSettings"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function DashboardPage() {
  const session = useAgentSession()
  const daemon = useKryptonDaemon()
  const [isVoiceAgentVisible, setIsVoiceAgentVisible] = useState(false)
  const [activeView, setActiveView] = useState<"workspace" | "settings">("workspace")
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>("general")

  // First-run setup state
  const [isSetupChecked, setIsSetupChecked] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [defaultWsDir, setDefaultWsDir] = useState("")

  // New Project Workspace modal state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [newProjName, setNewProjName] = useState("")
  const [newProjPath, setNewProjPath] = useState("")

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjName.trim()) return
    session.createProject(
      newProjName.trim(),
      newProjPath.trim() || `projects/${newProjName.trim()}`
    )
    setNewProjName("")
    setNewProjPath("")
    setIsNewProjectModalOpen(false)
  }

  // Synchronized Voice HUD / Krypton Synapse Toggle Handler
  const toggleVoiceHud = useCallback(async () => {
    if (typeof window !== "undefined" && isTauri()) {
      await invoke("toggle_synapse").catch(() => invoke("toggle_overlay").catch(console.error))
    } else {
      // In web browser preview mode without Tauri, fallback to in-DOM pill
      setIsVoiceAgentVisible((prev) => !prev)
    }
  }, [])

  // Global keyboard shortcuts: Ctrl+, / Cmd+, toggles settings, Ctrl+Shift+Space toggles Voice HUD
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault()
        setActiveView((prev) => (prev === "settings" ? "workspace" : "settings"))
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === " " || e.code === "Space")) {
        e.preventDefault()
        toggleVoiceHud()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleVoiceHud])

  // Detect host machine initialization state
  useEffect(() => {
    async function checkHostInitialization() {
      try {
        if (typeof window !== "undefined" && isTauri()) {
          const res = await invoke<{
            isInitialized: boolean
            customAgentName: string
            primaryModel: string
            defaultWorkspaceDir: string
            askForApproval: boolean
          }>("check_setup_status")

          if (!res.isInitialized) {
            setIsFirstRun(true)
            setDefaultWsDir(res.defaultWorkspaceDir)
          }
        } else {
          // Web preview fallback
          const localDone = typeof window !== "undefined" && localStorage.getItem("krypton_setup_completed")
          if (!localDone) {
            setIsFirstRun(true)
          }
        }
      } catch (err) {
        console.warn("Could not query setup status from host:", err)
      } finally {
        setIsSetupChecked(true)
      }
    }

    checkHostInitialization()
  }, [])

  // Handle successful setup wizard completion
  const handleSetupComplete = useCallback((data: SetupCompletedData) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("krypton_setup_completed", "true")
    }

    setIsFirstRun(false)
    setIsSetupModalOpen(false)

    // Synchronize newly configured settings into session state
    session.setSelectedModel(data.primaryModel)
    session.setAskForApproval(data.askForApproval)

    if (data.initialProjectName && session.projects.length === 0) {
      const fullPath = data.defaultWorkspaceDir
        ? `${data.defaultWorkspaceDir}/${data.initialProjectName}`
        : `projects/${data.initialProjectName}`
      session.createProject(data.initialProjectName, fullPath)
    }
  }, [session])

  // Show setup wizard screen if first run and not yet checked
  if (isFirstRun) {
    return (
      <FirstRunSetupWizard
        initialDefaultDir={defaultWsDir}
        onComplete={handleSetupComplete}
      />
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none antialiased">
      {/* 1. Unified Frameless Window Header with Native IPC Controls */}
      <WindowHeader
        projectName={session.activeProject?.name}
        threadTitle={activeView === "settings" ? `Settings / ${activeSettingsCategory}` : session.activeThread?.title}
        projects={session.projects}
        activeProjectId={session.activeProjectId}
        onSelectProject={(id) => {
          setActiveView("workspace")
          session.selectProject(id)
        }}
        isLeftSidebarOpen={session.isLeftSidebarOpen}
        isRightDrawerOpen={session.isRightDrawerOpen}
        onToggleLeftSidebar={() => session.setIsLeftSidebarOpen(!session.isLeftSidebarOpen)}
        onToggleRightDrawer={() => session.setIsRightDrawerOpen(!session.isRightDrawerOpen)}
        onNewChat={() => {
          setActiveView("workspace")
          session.createNewChat()
        }}
        onCreateProject={() => {
          setActiveView("workspace")
          setIsNewProjectModalOpen(true)
        }}
        onOpenSetupWizard={() => setIsSetupModalOpen(true)}
        onOpenSettings={(cat) => {
          if (cat) setActiveSettingsCategory(cat as SettingsCategory)
          setActiveView("settings")
        }}
        onToggleVoiceHud={toggleVoiceHud}
        canGoBack={activeView === "settings" ? true : session.canGoBack}
        canGoForward={session.canGoForward}
        onGoBack={() => {
          if (activeView === "settings") {
            setActiveView("workspace")
          } else {
            session.goBack()
          }
        }}
        onGoForward={session.goForward}
      />

      {/* 2. Main Workstation Shell or Krypton Settings Interface */}
      {activeView === "settings" ? (
        <div className="flex flex-1 overflow-hidden min-h-0 relative">
          <KryptonSettings
            initialCategory={activeSettingsCategory}
            onBack={() => setActiveView("workspace")}
            onUpdateApproval={session.setAskForApproval}
            onUpdateModel={session.setSelectedModel}
            onRefreshFleet={() => {
              if (typeof window !== "undefined") {
                const raw = localStorage.getItem("krypton_workstation_state_v2")
                if (raw) {
                  try {
                    const ws = JSON.parse(raw)
                    if (ws.fleet && daemon.setFleet) daemon.setFleet(ws.fleet)
                  } catch {
                    // ignore
                  }
                }
              }
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden min-h-0 relative">
          {/* Left Collapsible Projects & Threads Sidebar */}
          <ProjectSidebar
            projects={session.projects}
            activeProjectId={session.activeProjectId}
            activeThreadId={session.activeThreadId}
            onSelectProject={session.selectProject}
            onSelectThread={session.selectThread}
            onNewChat={session.createNewChat}
            onCreateProject={session.createProject}
            onDeleteThread={session.deleteThread}
            isOpen={session.isLeftSidebarOpen}
          />

          {/* Center Main Execution & Conversation Stream */}
          <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950 min-w-0 relative">
            {/* Conversation & Tool Cards Stream */}
            <ExecutionStream
              thread={session.activeThread}
              projectName={session.activeProject?.name || ""}
              onSelectPrompt={(prompt) => session.submitPrompt(prompt)}
              onReviewDiff={() => {
                session.setRightDrawerTab("diff")
                session.setIsRightDrawerOpen(true)
              }}
              onResolveApproval={session.resolveMessageApproval}
              onCreateProject={() => session.createProject("my-project", "projects/my-project")}
              isStreaming={session.isStreaming}
            />

            {/* Sticky Bottom Unified Command Bar */}
            <CommandContextBar
              projectName={session.activeProject?.name || ""}
              branchName={session.activeProject?.branch || ""}
              isLocal={true}
              model={session.selectedModel}
              onModelChange={session.setSelectedModel}
              availableModels={session.availableModels}
              onRefreshModels={session.refreshModels}
              isRefreshingModels={session.isRefreshingModels}
              activeProvider={session.activeProvider}
              askForApproval={session.askForApproval}
              onToggleApproval={() => session.setAskForApproval(!session.askForApproval)}
              onSubmitPrompt={(p) => session.submitPrompt(p)}
              onVoiceTrigger={toggleVoiceHud}
            />
          </main>

          {/* Right Collapsible Outputs Drawer */}
          <OutputsDrawer
            isOpen={session.isRightDrawerOpen}
            onClose={() => session.setIsRightDrawerOpen(false)}
            activeTab={session.rightDrawerTab}
            onTabChange={session.setRightDrawerTab}
            tasks={daemon.tasks}
            logs={daemon.logs}
            fleet={daemon.fleet}
            diffData={daemon.activeDiff}
            availableModels={session.availableModels}
            onApproveMerge={daemon.approveMerge}
            onRollbackStep={daemon.rollbackStep}
            onRejectAbort={daemon.rejectAbort}
            onCreateAgent={daemon.createAgent}
            onControlProcess={daemon.controlProcess}
            telemetry={daemon.telemetry}
          />
        </div>
      )}

      {/* Floating Voice Presence (Toggled via header or mic button, visible in web preview fallback mode) */}
      {!isTauri() && isVoiceAgentVisible && (
        <FloatingVoiceAgent
          activeAgentName={session.activeAgentName || session.activeProject?.name || "Orchestrator"}
          availableAgents={
            daemon.fleet && daemon.fleet.length > 0
              ? daemon.fleet.map((a) => a.name)
              : ["Orchestrator", "CoderBot", "TesterBot", "Scraper"]
          }
          onSelectAgent={(agent) => {
            session.setActiveAgentName(agent)
          }}
          onSubmitPrompt={(prompt) => session.submitPrompt(prompt)}
          isAssistantThinking={session.isStreaming}
          latestAssistantText={session.latestAssistantText}
          onClose={() => setIsVoiceAgentVisible(false)}
        />
      )}

      {/* Human-in-the-Loop Clarification Dialog */}
      <QuestionModal
        request={daemon.activeClarification}
        isOpen={daemon.isQuestionModalOpen}
        onResolve={daemon.respondClarification}
        onDismiss={() => daemon.setIsQuestionModalOpen(false)}
      />

      {/* Fullscreen Git Worktree Diff Viewer Modal */}
      {daemon.isDiffModalOpen && daemon.activeDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6 animate-in fade-in-0 duration-200">
          <div className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
            <VcsDiffViewer
              diff={daemon.activeDiff}
              onApproveMerge={daemon.approveMerge}
              onRollbackStep={daemon.rollbackStep}
              onRejectAbort={daemon.rejectAbort}
              onClose={() => daemon.setIsDiffModalOpen(false)}
            />
          </div>
        </div>
      )}

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
                placeholder="e.g. agent-workspace"
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
                placeholder="e.g. C:/Projects/my-app"
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

      {/* SETUP WIZARD / PREFERENCES MODAL */}
      <Dialog open={isSetupModalOpen} onOpenChange={setIsSetupModalOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 p-0 overflow-hidden">
          <FirstRunSetupWizard
            isModal={true}
            initialDefaultDir={defaultWsDir}
            onComplete={handleSetupComplete}
            onCancel={() => setIsSetupModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
