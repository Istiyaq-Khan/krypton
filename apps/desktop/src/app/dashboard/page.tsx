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
import { Dialog, DialogContent } from "@/components/ui/dialog"

export default function DashboardPage() {
  const session = useAgentSession()
  const daemon = useKryptonDaemon()
  const [isVoiceAgentVisible, setIsVoiceAgentVisible] = useState(false)

  // First-run setup state
  const [isSetupChecked, setIsSetupChecked] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [defaultWsDir, setDefaultWsDir] = useState("")

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
        threadTitle={session.activeThread?.title}
        isLeftSidebarOpen={session.isLeftSidebarOpen}
        isRightDrawerOpen={session.isRightDrawerOpen}
        onToggleLeftSidebar={() => session.setIsLeftSidebarOpen(!session.isLeftSidebarOpen)}
        onToggleRightDrawer={() => session.setIsRightDrawerOpen(!session.isRightDrawerOpen)}
        onNewChat={session.createNewChat}
        onCreateProject={() => session.createProject("my-project", "projects/my-project")}
        onOpenSetupWizard={() => setIsSetupModalOpen(true)}
        canGoBack={session.canGoBack}
        canGoForward={session.canGoForward}
        onGoBack={session.goBack}
        onGoForward={session.goForward}
      />

      {/* 2. Main Workstation Shell */}
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
            onVoiceTrigger={() => setIsVoiceAgentVisible(true)}
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

      {/* Floating Voice Presence (Toggled via header or mic button) */}
      {isVoiceAgentVisible && (
        <FloatingVoiceAgent
          activeAgentName={session.activeProject?.name || "Krypton"}
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
