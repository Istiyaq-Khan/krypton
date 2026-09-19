"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { WindowHeader } from "@/components/layout/WindowHeader"
import { CodexSettings, SettingsCategory } from "@/components/settings/CodexSettings"
import { FloatingVoiceAgent } from "@/components/voice/FloatingVoiceAgent"
import { useAgentSession } from "@/hooks/useAgentSession"

export default function SettingsPage() {
  const router = useRouter()
  const session = useAgentSession()
  const [isVoiceAgentVisible, setIsVoiceAgentVisible] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general")

  // Keyboard shortcut listener: Ctrl+, or Cmd+, toggles back to dashboard
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault()
        router.push("/dashboard")
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === " " || e.code === "Space")) {
        e.preventDefault()
        setIsVoiceAgentVisible((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none antialiased">
      {/* Unified Frameless Window Header */}
      <WindowHeader
        projectName={session.activeProject?.name}
        threadTitle={`Settings / ${activeCategory}`}
        isLeftSidebarOpen={false}
        isRightDrawerOpen={false}
        onToggleLeftSidebar={() => {}}
        onToggleRightDrawer={() => {}}
        onNewChat={() => router.push("/dashboard")}
        onCreateProject={() => router.push("/dashboard")}
        onOpenSettings={(cat) => {
          if (cat) setActiveCategory(cat as SettingsCategory)
        }}
        onToggleVoiceHud={() => setIsVoiceAgentVisible((v) => !v)}
        canGoBack={true}
        canGoForward={false}
        onGoBack={() => router.push("/dashboard")}
      />

      {/* Main Codex Settings Interface */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        <CodexSettings
          initialCategory={activeCategory}
          onBack={() => router.push("/dashboard")}
          onUpdateApproval={session.setAskForApproval}
          onUpdateModel={session.setSelectedModel}
        />
      </div>

      {/* Floating Voice HUD (Elevated top-level overlay with highest z-index) */}
      {isVoiceAgentVisible && (
        <FloatingVoiceAgent
          activeAgentName={session.activeProject?.name || "Krypton"}
          onSubmitPrompt={(prompt) => {
            session.submitPrompt(prompt)
            router.push("/dashboard")
          }}
          isAssistantThinking={session.isStreaming}
          latestAssistantText={session.latestAssistantText}
          onClose={() => setIsVoiceAgentVisible(false)}
        />
      )}
    </div>
  )
}
