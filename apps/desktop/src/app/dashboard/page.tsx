"use client"

import React, { useState } from "react"
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
import { FloatingVoiceAgent } from "@/components/voice/FloatingVoiceAgent"

export default function DashboardPage() {
  const session = useAgentSession()
  const daemon = useKryptonDaemon()
  const [isVoiceAgentVisible, setIsVoiceAgentVisible] = useState(true)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none antialiased">
      {/* 1. Window Chrome / Title Header */}
      <WindowHeader
        projectName={session.activeProject.name}
        threadTitle={session.activeThread?.title}
        isLeftSidebarOpen={session.isLeftSidebarOpen}
        isRightDrawerOpen={session.isRightDrawerOpen}
        onToggleLeftSidebar={() => session.setIsLeftSidebarOpen(!session.isLeftSidebarOpen)}
        onToggleRightDrawer={() => session.setIsRightDrawerOpen(!session.isRightDrawerOpen)}
        onNewChat={session.createNewChat}
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
            onResolveApproval={session.resolveMessageApproval}
            isStreaming={session.isStreaming}
          />

          {/* Rate Limit / Context Usage Banner */}
          <QuotaBanner
            usagePercent={session.userProfile.tokenUsagePercent}
            tokensUsed={session.userProfile.tokensUsed}
            tokensLimit={session.userProfile.tokensLimit}
            planName={session.userProfile.planName}
          />

          {/* Sticky Bottom Unified Command Bar */}
          <CommandContextBar
            projectName={session.activeProject.name}
            branchName={session.activeProject.branch}
            isLocal={true}
            model={session.selectedModel}
            onModelChange={session.setSelectedModel}
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
          onApproveMerge={daemon.approveMerge}
          onRollbackStep={daemon.rollbackStep}
          onRejectAbort={daemon.rejectAbort}
          onCreateAgent={daemon.createAgent}
          onControlProcess={daemon.controlProcess}
          telemetry={daemon.telemetry}
        />
      </div>

      {/* Ultra-Premium Floating Voice Presence */}
      {isVoiceAgentVisible && (
        <FloatingVoiceAgent
          activeAgentName={session.activeProject.name}
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
    </div>
  )
}
