"use client"

import React from "react"
import { useAgentSession } from "@/hooks/useAgentSession"
import { useKryptonDaemon } from "@/hooks/useKryptonDaemon"
import { WindowHeader } from "@/components/layout/WindowHeader"
import { ProjectSidebar } from "@/components/layout/ProjectSidebar"
import { OutputsDrawer } from "@/components/layout/OutputsDrawer"
import { ExecutionStream } from "@/components/stream/ExecutionStream"
import { QuotaBanner } from "@/components/stream/QuotaBanner"
import { CommandContextBar } from "@/components/chatbar/CommandContextBar"
import { QuestionModal } from "@/components/QuestionModal"
import { VcsDiffViewer } from "@/components/VcsDiffViewer"

export default function DashboardPage() {
  const session = useAgentSession()
  const daemon = useKryptonDaemon()

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none antialiased">
      {/* 1. Window Chrome / Title Header (Matching Images 2, 3, 4) */}
      <WindowHeader
        projectName={session.activeProject.name}
        threadTitle={session.activeThread?.title}
        isLeftSidebarOpen={session.isLeftSidebarOpen}
        isRightDrawerOpen={session.isRightDrawerOpen}
        onToggleLeftSidebar={() => session.setIsLeftSidebarOpen(!session.isLeftSidebarOpen)}
        onToggleRightDrawer={() => session.setIsRightDrawerOpen(!session.isRightDrawerOpen)}
        onNewChat={session.createNewChat}
      />

      {/* 2. Main Workstation Shell (Flex Layout with Sidebar, Stream, and Outputs Drawer) */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Left Collapsible Projects & Threads Sidebar (Image 2/3/4) */}
        <ProjectSidebar
          projects={session.projects}
          activeProjectId={session.activeProjectId}
          activeThreadId={session.activeThreadId}
          onSelectProject={session.selectProject}
          onSelectThread={session.selectThread}
          onNewChat={session.createNewChat}
          userProfile={session.userProfile}
          isOpen={session.isLeftSidebarOpen}
        />

        {/* Center Main Execution & Conversation Stream */}
        <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950 min-w-0 relative">
          {/* Conversation & Tool Cards Stream */}
          <ExecutionStream
            thread={session.activeThread}
            projectName={session.activeProject.name}
            onSelectPrompt={(prompt) => session.submitPrompt(prompt)}
            onReviewDiff={() => {
              session.setRightDrawerTab("diff")
              session.setIsRightDrawerOpen(true)
            }}
          />

          {/* Rate Limit / Context Usage Banner (Matching Images 2 & 3) */}
          <QuotaBanner
            usagePercent={session.userProfile.tokenUsagePercent}
            tokensUsed={session.userProfile.tokensUsed}
            tokensLimit={session.userProfile.tokensLimit}
            planName={session.userProfile.planName}
          />

          {/* Sticky Bottom Unified Command Bar (Images 2, 3, 4) */}
          <CommandContextBar
            projectName={session.activeProject.name}
            branchName={session.activeProject.branch}
            isLocal={true}
            model={session.selectedModel}
            onModelChange={session.setSelectedModel}
            askForApproval={session.askForApproval}
            onToggleApproval={() => session.setAskForApproval(!session.askForApproval)}
            onSubmitPrompt={(p) => session.submitPrompt(p)}
            onVoiceTrigger={() => {
              if (typeof window !== "undefined") {
                window.open("/overlay", "_blank", "width=640,height=130")
              }
            }}
          />
        </main>

        {/* Right Collapsible Outputs Drawer (Image 4 right pane) */}
        <OutputsDrawer
          isOpen={session.isRightDrawerOpen}
          onClose={() => session.setIsRightDrawerOpen(false)}
          activeTab={session.rightDrawerTab}
          onTabChange={session.setRightDrawerTab}
          tasks={daemon.tasks}
          logs={daemon.logs}
          fleet={daemon.fleet}
          diffData={daemon.activeDiff}
          onApproveMerge={daemon.approveMerge}
          onRollbackStep={daemon.rollbackStep}
          onRejectAbort={daemon.rejectAbort}
        />
      </div>

      {/* Human-in-the-Loop Clarification Dialog */}
      <QuestionModal
        request={daemon.activeClarification}
        isOpen={daemon.isQuestionModalOpen}
        onResolve={daemon.respondClarification}
        onDismiss={() => daemon.setIsQuestionModalOpen(false)}
      />

      {/* Fullscreen Git Worktree Diff Viewer Modal (if opened separately) */}
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
    </div>
  )
}
